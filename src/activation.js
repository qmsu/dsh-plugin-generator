// 插件激活与依赖处理（页面「安装/更新/预检」与 scaffold_validate 深检共用）。
// 关键事实（已核对 dsh 源码）：
//   - pnpm 对本地目录走 link: 协议，link 包的 dependencies 不会被安装 → 运行时 import 失败（failed to import）。
//   - defineTool 在调用时即编译 schema，schema 非法会抛 JsonSchemaError → 用 import + apply 就能在安装前发现。
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** 读取插件 package.json；失败返回 null。 */
export function readPluginPackage(pluginDir) {
  try {
    return JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
}

/**
 * 在插件目录内安装它声明的 dependencies（link 装进 profile 时不会带）。
 * pnpm 优先、npm 兜底；没有 dependencies 或已有 node_modules 则跳过。
 * 失败抛错。
 */
export function ensurePluginDeps(pluginDir) {
  const pkg = readPluginPackage(pluginDir)
  if (!pkg) throw new Error('读取 package.json 失败')
  const deps = pkg.dependencies ?? {}
  const peers = pkg.peerDependencies ?? {}
  if (Object.keys(deps).length === 0 && Object.keys(peers).length === 0) return
  if (existsSync(join(pluginDir, 'node_modules'))) return
  let lastError = ''
  for (const [cmd, args] of [['pnpm', ['install']], ['npm', ['install', '--no-audit', '--no-fund']]]) {
    const run = spawnSync(cmd, args, { cwd: pluginDir, encoding: 'utf8', timeout: 300_000 })
    if (!run.error && run.status === 0) return
    lastError = `${cmd}: ${run.error?.message || String(run.stderr || '').slice(-400)}`
  }
  throw new Error(`依赖安装失败（${lastError}）`)
}

/**
 * 激活预检：装依赖 → import 入口 → 以 mock ctx 跑 apply()，让 defineTool 的真实 schema 编译暴露错误。
 * dsh 官方 runtime 里插件入口只需 export { apply }，apply 用 ctx.tools.register(defineTool(...))。
 * @returns { ok, tools?, error? }
 */
export async function activationDryRun(pluginDir) {
  const pkg = readPluginPackage(pluginDir)
  if (!pkg) return { ok: false, error: '读取 package.json 失败' }
  const main = pkg.main ?? 'src/index.js'
  const abs = join(pluginDir, main)
  if (!existsSync(abs)) return { ok: false, error: `入口不存在: ${main}` }

  try {
    ensurePluginDeps(pluginDir)
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) }
  }

  const registered = []
  const mock = {
    tools: { register: (tool) => registered.push(tool?.name) },
    skills: { register: () => {} },
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    on: () => () => {},
    once: () => () => {},
    effect: () => {},
    get: () => undefined,
  }

  try {
    const mod = await import(`${pathToFileURL(abs).href}?preflight=${Date.now()}`)
    const applyFn = mod?.apply ?? mod?.default
    if (typeof applyFn === 'function') {
      // 模拟 cordis fiber 的真实规则：模块声明了哪些 inject 就允许用哪些服务属性，
      // 访问未声明的服务直接抛错（跟 runtime 的 "cannot get property X without inject" 一致）。
      const declared = new Set(Array.isArray(mod.inject) ? mod.inject.map(String) : [])
      const guarded = new Proxy(mock, {
        get(target, prop) {
          const key = String(prop)
          const isService = ['tools', 'skills', 'systemPrompt', 'attachments', 'agentSession', 'webServer', 'webhookRuntime', 'slots', 'locale', 'layout'].includes(key)
          if (isService && !declared.has(key)) {
            throw new Error(`cannot get property "${key}" without inject：请在入口声明 export const inject = ['${key}', ...]`)
          }
          return target[prop]
        },
      })
      const r = applyFn(guarded, pkg.dsh?.config ?? {})
      if (r && typeof r.then === 'function') await r
    }
    return { ok: true, tools: registered }
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) }
  }
}