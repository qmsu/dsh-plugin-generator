// scaffold_probe_mcp：探测 MCP server 可达性（toolkit 模板交付前的检查）。
// stdio 判「命令能否解析」、streamable-http 判「URL 是否 TCP 可达」。
// 不真正 spawn MCP client、不列出工具——那属于安装后 dsh 运行时（failOnStartupError）的职责。
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { textBlock } from './util.js'

// 懒加载 runner：本体可解析即视为可启动，工具包在 MCP 首次连接时才下载
const LAZY_RUNNERS = new Set(['npx', 'uvx', 'pipx', 'bunx', 'pnpm', 'pnpx', 'yarn'])

function commandResolvable(cmd) {
  const command = String(cmd ?? '').trim()
  if (!command) return null
  // 含路径（绝对/相对）直接查存在
  if (command.includes('/')) return existsSync(command) ? `命令「${command}」存在` : null
  const base = command.split(/\s+/)[0]
  const run = spawnSync('bash', ['-lc', `command -v "${base}"`], { encoding: 'utf8', timeout: 8000 })
  if (run.status === 0 && String(run.stdout).trim()) {
    return LAZY_RUNNERS.has(base)
      ? `runner「${base}」可解析（MCP 工具包在首次连接时下载）`
      : `命令「${base}」可解析`
  }
  return null
}

function tcpReachable(urlStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(String(urlStr))
      const host = u.hostname
      const port = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80)
      const socket = net.connect({ host, port, timeout: 3000 })
      socket.on('connect', () => { socket.destroy(); resolve({ ok: true, detail: `${host}:${port} TCP 可达` }) })
      socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, detail: `${host}:${port} 连接超时` }) })
      socket.on('error', (e) => resolve({ ok: false, detail: `${host}:${port} 不可达：${e.code ?? e.message}` }))
    } catch (e) {
      resolve({ ok: false, detail: `URL 解析失败：${e?.message ?? e}` })
    }
  })
}

/** 探测单个 MCP server，返回 { serverName, transport, reachable, detail }。 */
export function probeMcpServer(server) {
  const transport = String(server?.transport ?? '') === 'streamable-http' ? 'streamable-http' : 'stdio'
  const serverName = String(server?.serverName ?? '')
  if (transport === 'streamable-http') {
    return tcpReachable(server?.url).then((r) => ({ serverName, transport, reachable: r.ok, detail: r.detail }))
  }
  const command = String(server?.command ?? '').trim()
  const detail = commandResolvable(command)
  return Promise.resolve({
    serverName,
    transport,
    reachable: detail !== null,
    detail: detail ?? `命令「${command || '(空)'}」未找到（安装对应工具包，或改用绝对路径后重试）`,
  })
}

export function registerProbeTool(ctx) {
  ctx.tools.register(defineTool({
    name: 'scaffold_probe_mcp',
    description: '探测 MCP server 可达性：stdio 判命令能否解析、streamable-http 判 URL 是否 TCP 可达。toolkit 模板交付前的检查，不真正连接、不列工具。',
    parameters: {
      servers: {
        type: 'json',
        required: true,
        description: 'MCP server 清单（与 plan.mcp 同形）：[{ serverName, transport, command?, args?, env?, cwd?, url?, headers? }]',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          results: { type: 'array', required: true },
        },
      },
      render: (args, value) => textBlock(
        value.results.map((r) => `${r.reachable ? '✔ 可达' : '✘ 不可达'} ${r.serverName}（${r.transport}）：${r.detail}`).join('\n') || '（无）',
      ),
    },
    execute: async (args) => {
      const servers = Array.isArray(args.servers) ? args.servers : []
      const results = []
      for (const s of servers) results.push(await probeMcpServer(s))
      return { results }
    },
  }))
}