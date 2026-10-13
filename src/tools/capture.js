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

  // 整段问答原文（transcript）：范围内、有文本的对话块按序排出。
  // 一个会话可能产出多个成果物（如文章 + 配图提示词），单靠 finalResult 只拿到最后一条，
  // 制作会话看不到更早的产物。transcript 把每个阶段的原文都交出来，供按阶段固化成多个 标杆/示例/产物。
  const transcript = []
  for (const e of events) {
    if (!inScope(e)) continue
    const t = e.type === 'user/message' && e.data?.source?.kind === 'user'
      ? contentText(e.data?.content, true)
      : e.type === 'assistant/message' ? contentText(e.data?.message?.content, true) : ''
    if (t) transcript.push({ role: e.type === 'assistant/message' ? 'assistant' : 'user', text: t })
  }

  // 产物格式（heuristic 提示，非权威；制作会话可结合 transcript 校正）
  const transcriptText = transcript.map((t) => t.text).join('\n')
  const finalFormat = inferFormat(finalResult, procedure, transcriptText)
  // 是否含"交互决策点"：助手列出一组候选、紧随其后用户在其中挑一个
  const hasDecision = inferHasDecision(transcript)

  return { title, requirement, finalResult, procedure, turns, transcript, finalFormat, hasDecision }
}

/** 从最终结果文本 + 工具名 + 整段问答，推断产物格式。仅为提示，供固化时钉死产物形式。 */
function inferFormat(finalResult, procedure, transcriptText) {
  const all = (finalResult || '') + '\n' + (transcriptText || '')
  if (/\.docx\b/i.test(all) || procedure.some((t) => /docx|word/i.test(t))) return 'docx'
  if (/<html|<!DOCTYPE|<h[1-6]\b|<\/[a-z]+>/i.test(finalResult)) return 'html'
  if (/^#{1,6}\s+|\|.+\||```|(^|\n)[-*] /.test(String(finalResult))) return 'md'
  return 'plain'
}

/** 推断会话是否含"交互决策点"：助手抛出一组候选选项 → 用户从中挑一个。heuristic。 */
function inferHasDecision(transcript) {
  for (let i = 0; i < transcript.length - 1; i++) {
    const a = transcript[i]
    const u = transcript[i + 1]
    if (a.role !== 'assistant' || u.role !== 'user') continue
    if (countOptions(a.text) < 2) continue
    if (isPick(u.text)) return true
  }
  return false
}
function countOptions(t) {
  const numbered = (t.match(/^[ \t]*(?:\d+[、.．]|[-·•*]|（?\s*[一二三四五六七八九十]\s*[、)）.])[ \t]*/gm) || []).length
  if (numbered >= 2) return numbered
  const labeled = (t.match(/(方案|选题|主题|选项|候选|备选)\s*[A-Za-z0-9一二三四五六七八九十\d]/g) || []).length
  return labeled
}
function isPick(t) {
  const s = String(t).trim()
  if (!s || s.length > 80) return false
  const num = '[0-9一二三四五六七八九十A-Da-d]'
  return new RegExp(`第\\s*${num}+\\s*[个项条位]`).test(s) ||
    new RegExp(`(选|挑|要|就选|就|定|决定|用|跟)(第|主题|选题|方案|选项|个|项|条|号)?\\s*${num}`).test(s) ||
    new RegExp(`(主题|选题|方案|选项|号)\\s*${num}`).test(s)
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
        description: '固化范围截止的 assistant 消息 id（会话日志里 assistant/message 的 message.id）。给定后只提取到该条回复为止（含）的需求/结果/过程/整段问答；缺省为整段会话',
      },
      maxTranscriptBytes: {
        type: 'integer',
        description: '整段问答 transcript 文本抽取上限（UTF-8 字节），默认 60000。会话产出多个成果物（如文章 + 配图提示词）时，transcript 是识别各阶段成果的关键，别用小值',
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
          transcript: { type: 'string' },
          transcriptTruncated: { type: 'boolean' },
          finalFormat: { type: 'string' },
          hasDecision: { type: 'boolean' },
        },
      },
      render: (args, value) => textBlock(
        `会话素材（${value.sessionId}${value.title ? `，${value.title}` : ''}，${value.turns} 轮）\n\n` +
        `【需求原文】\n${value.requirement || '（未取到）'}\n\n` +
        `【最终结果】${value.truncated ? '（已截断）' : ''}\n${value.finalResult || '（未取到）'}\n\n` +
        `【整段问答】${value.transcript != null ? `${Math.round(value.transcript.length / 1024)}KB（${value.transcriptTruncated ? '已截断' : '全文'}，正快速核对：识别有哪些独立的成果物/阶段）` : ''}\n` +
        `【产物格式】${value.finalFormat ?? 'plain'}${value.hasDecision ? '　⚠ 检测到交互决策点（先给候选选项、用户挑了其中一个）' : ''}\n` +
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
      // 整段问答拼成可读文本，按字节截断
      const maxTranscriptBytes = Number(args.maxTranscriptBytes ?? 60000)
      let transcript = String(parsed.transcript.map((t) => `【${t.role === 'user' ? '用户' : '助手'}】${t.text}`).join('\n\n'))
      let transcriptTruncated = false
      if (Buffer.byteLength(transcript, 'utf8') > maxTranscriptBytes) {
        transcript = Buffer.from(transcript, 'utf8').subarray(0, maxTranscriptBytes).toString('utf8') + '\n…[transcript 已截断，重跑请传更大 maxTranscriptBytes]'
        transcriptTruncated = true
      }
      return { sessionId: id, title: parsed.title, requirement: parsed.requirement, finalResult, procedure: parsed.procedure, turns: parsed.turns, truncated, transcript, transcriptTruncated, finalFormat: parsed.finalFormat, hasDecision: parsed.hasDecision }
    },
  }))
}
