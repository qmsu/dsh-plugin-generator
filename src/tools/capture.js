// scaffold_capture：从一次已有 dsh 会话提取"能力固化"素材（需求原文、最终结果、工具过程），
// 供 capability 模板生成"复现该能力"的插件（skill 规矩 + 确定性手脚）。
// 会话日志是追加写的多帧 zstd（node:zlib 只能解单帧），这里按帧魔数扫描逐帧解压。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { textBlock } from './util.js'

const SESSIONS_ROOT = join(homedir(), '.dsh', 'sessions')
const FRAME_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

/** 多帧 zstd：从每个魔数位置尝试解到下一个魔数，贪婪取第一个能干净解压的边界。 */
function decompressFrames(buf) {
  const outs = []
  let pos = 0
  while (pos < buf.length) {
    const idx = buf.indexOf(FRAME_MAGIC, pos)
    if (idx === -1) break
    let end = -1
    let from = idx + 4
    for (;;) {
      const next = buf.indexOf(FRAME_MAGIC, from)
      const cand = next === -1 ? buf.length : next
      try {
        outs.push(zstdDecompressSync(buf.subarray(idx, cand)))
        end = cand
        break
      } catch (e) {
        if (next === -1) throw new Error(`会话日志 zstd 帧解压失败: ${e.message}`)
        from = next + 1
      }
    }
    pos = end
  }
  return Buffer.concat(outs)
}

// 与 dsh-session-persistence-jsonl 的 projectKey() 一致（分隔符折叠为 -，非法字符 ~XXXX，包 --...--）
function workspaceSlug(cwd) {
  let readable = ''
  let separatorRun = false
  for (const ch of String(cwd)) {
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += '~' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')
      separatorRun = false
    }
  }
  return `--${(readable.replace(/^-+/, '') || 'root').slice(0, 251)}--`
}

/** 定位会话目录：优先指定 workspace，否则全局扫 ~/.dsh/sessions。 */
function findSessionDir(sessionId, workspacePath) {
  if (workspacePath) {
    const dir = join(SESSIONS_ROOT, workspaceSlug(workspacePath), sessionId)
    if (existsSync(join(dir, 'session.v4.jsonl.zstd'))) return dir
  }
  for (const ws of readdirSync(SESSIONS_ROOT)) {
    const dir = join(SESSIONS_ROOT, ws, sessionId)
    if (existsSync(join(dir, 'session.v4.jsonl.zstd'))) return dir
  }
  return null
}

/** 取某 workspace 下最近活跃的会话目录（按日志 mtime）。 */
function latestSessionDir(workspacePath) {
  const wsDir = join(SESSIONS_ROOT, workspaceSlug(workspacePath))
  if (!existsSync(wsDir)) return null
  let best = null
  let bestMtime = 0
  for (const id of readdirSync(wsDir)) {
    const f = join(wsDir, id, 'session.v4.jsonl.zstd')
    if (!existsSync(f)) continue
    const mt = statSync(f).mtimeMs
    if (mt > bestMtime) { bestMtime = mt; best = join(wsDir, id) }
  }
  return best
}

/** 把 content 数组（dsh 消息块）拼成纯文本；skipReasoning 时只取 text 块。 */
function contentText(content, skipReasoning = false) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((b) => b && (b.type === 'text' || (!skipReasoning && b.type === 'reasoning')))
    .map((b) => String(b.text ?? ''))
    .join('\n')
    .trim()
}

/** 解析会话 JSONL，抽出固化素材。upToMessageId 给定则只取到该 assistant 消息为止（含）。 */
function parseSession(text, upToMessageId) {
  const events = text.split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l) } catch { return null }
  }).filter(Boolean)

  // 截止位置：按消息 id 定位 assistant 事件，取其 seq 为界
  let cutoff = Infinity
  if (upToMessageId) {
    const target = events.find((e) => e.type === 'assistant/message' && e.data?.message?.id === upToMessageId)
    if (target) cutoff = target.seq
  }
  const inScope = (e) => e.seq <= cutoff

  const title = events.find((e) => e.type === 'session/title')?.data?.title ?? null
  const firstUser = events.find((e) => e.type === 'user/message' && e.data?.source?.kind === 'user')
  const requirement = contentText(firstUser?.data?.content).slice(0, 2000)

  const assistants = events.filter((e) => e.type === 'assistant/message' && inScope(e))
  // 预切只防极端超长（如整个产物当一条回复），正常不应触发；真正的上限在 maxResultBytes 处按字节截
  const finalResult = contentText(assistants.at(-1)?.data?.message?.content, true).slice(0, 200000)

  // 工具调用序列（去重保序）：固化"当时是怎么做的"
  const procedure = []
  for (const e of events) {
    if (e.type === 'tool/call' && inScope(e) && e.data?.name && !procedure.includes(e.data.name)) procedure.push(String(e.data.name))
  }
  const turns = events.filter((e) => e.type === 'turn/end' && inScope(e)).length
  return { title, requirement, finalResult, procedure, turns }
}

export function registerCaptureTool(ctx) {
  ctx.tools.register(defineTool({
    name: 'scaffold_capture',
    description: '从一次已有 dsh 会话提取能力固化素材（需求原文/最终结果/工具过程），用于生成"复现该能力"的 capability 插件。是 capability 模板流程的第 1 步。',
    parameters: {
      sessionId: {
        type: 'string',
        description: '会话 id（session-xxx / webhook-xxx）。缺省默认"当前会话"（工具被哪个会话调用就抓哪个）；也可只给 workspacePath 取该工作区最近一次的会话',
      },
      workspacePath: {
        type: 'string',
        description: '工作区路径（如 /Users/zg/dsh-scaffold），用于定位会话目录或取最近一次会话',
      },
      maxResultBytes: {
        type: 'integer',
        description: '最终结果文本抽取上限（UTF-8 字节），默认 60000。能力固化要拿原始产出全文作标杆示例，不要用小值',
      },
      upToMessageId: {
        type: 'string',
        description: '固化范围截止的 assistant 消息 id（会话日志里 assistant/message 的 message.id）。给定后只提取到该条回复为止（含）的需求/结果/过程；缺省为整段会话',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sessionId: { type: 'string', required: true },
          title: { type: 'string' },
          requirement: { type: 'string', required: true },
          finalResult: { type: 'string', required: true },
          procedure: { type: 'array', required: true },
          turns: { type: 'integer', required: true },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => textBlock(
        `会话素材（${value.sessionId}${value.title ? `，${value.title}` : ''}，${value.turns} 轮）\n\n` +
        `【需求原文】\n${value.requirement || '（未取到）'}\n\n` +
        `【最终结果】${value.truncated ? '（已截断）' : ''}\n${value.finalResult || '（未取到）'}\n\n` +
        `【当时用到的工具】${value.procedure.join(' → ') || '（无）'}`,
      ),
    },
    execute: async (args, exec) => {
      // 缺省抓"当前会话"：defineTool 的 exec.agent.id 即调用本会话的 SessionId（dsh-agent 类型核实）
      const sessionId = String(args.sessionId ?? '').trim() || (exec.agent?.id ? String(exec.agent.id) : '')
      const workspacePath = String(args.workspacePath ?? '').trim()
      if (!sessionId && !workspacePath) {
        throw new Error('无法确定会话：sessionId 缺省取当前会话，但 exec.agent 未提供；请显式传 sessionId 或 workspacePath')
      }
      const dir = sessionId ? findSessionDir(sessionId, workspacePath || undefined) : latestSessionDir(workspacePath)
      if (!dir) throw new Error(`找不到会话${sessionId ? ` ${sessionId}` : ''}${workspacePath ? `（工作区 ${workspacePath}）` : ''}的日志`)
      const logPath = join(dir, 'session.v4.jsonl.zstd')
      const buf = readFileSync(logPath)
      const text = decompressFrames(buf).toString('utf8')
      exec.signal?.throwIfAborted()

      const parsed = parseSession(text, String(args.upToMessageId ?? '').trim() || undefined)
      const id = dir.split('/').pop()
      const maxResultBytes = Number(args.maxResultBytes ?? 60000)
      let finalResult = parsed.finalResult
      let truncated = false
      if (Buffer.byteLength(finalResult, 'utf8') > maxResultBytes) {
        finalResult = Buffer.from(finalResult, 'utf8').subarray(0, maxResultBytes).toString('utf8') + '\n…[已截断]'
        truncated = true
      }
      return { sessionId: id, title: parsed.title, requirement: parsed.requirement, finalResult, procedure: parsed.procedure, turns: parsed.turns, truncated }
    },
  }))
}
