// 页面路由认证回归：dsh 支持插件 live 安装，已打开的 index 不会重新注入插件私有 token。
// 因此页面路由必须复用 connection 的浏览器认证，而不是依赖 index 注入的 token。
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

const home = mkdtempSync(join(tmpdir(), 'dsh-plugin-scaffold-home-'))
process.env.HOME = home
const { registerScaffoldPage } = await import('../src/page.js')

let route
const webServer = {
  register(spec) {
    route = spec
    return () => {}
  },
}
const connection = {
  requestRejection(req) {
    return req.headers.cookie === 'dsh=valid' ? undefined : 401
  },
}
const ctx = {
  logger: { info() {}, warn() {}, error() {}, debug() {} },
  get(name) {
    if (name === 'webServer') return webServer
    if (name === 'connection') return connection
    return undefined
  },
  on() { return () => {} },
  effect() {},
}

registerScaffoldPage(ctx, { outputDir: join(home, 'scaffold') })
if (!route) throw new Error('页面路由未挂载')

async function postSettings(headers) {
  const req = Readable.from([Buffer.from(JSON.stringify({ outputDir: join(home, 'plugins') }))])
  req.method = 'POST'
  req.url = '/plugin-scaffold/settings'
  req.headers = { 'content-type': 'application/json', ...headers }
  const res = {
    statusCode: 0,
    body: '',
    writeHead(code) { this.statusCode = code },
    end(body = '') { this.body = String(body) },
  }
  await route.handler(req, res)
  return res
}

try {
  const accepted = await postSettings({ cookie: 'dsh=valid' })
  if (accepted.statusCode !== 200) {
    throw new Error(`已通过 dsh 浏览器认证的请求不应要求插件 token，实际 ${accepted.statusCode}: ${accepted.body}`)
  }

  const rejected = await postSettings({})
  if (rejected.statusCode !== 401) {
    throw new Error(`未通过 dsh 浏览器认证的请求应被拒绝，实际 ${rejected.statusCode}: ${rejected.body}`)
  }

  console.log('PAGE AUTH TEST OK')
} finally {
  rmSync(home, { recursive: true, force: true })
}
