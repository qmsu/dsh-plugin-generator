// 「制作插件」Web 页面的 host 半区：HTTP 路由（设置/列表/制作/插件操作/导出）+ 会话创建。
// 仅在 web 宿主生效（webServer 与 webhookRuntime 服务可用时自动装载，headless 等环境静默跳过）。
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { activationDryRun, ensurePluginDeps, readPluginPackage } from './activation.js'
import { getOutputDir, listPlugins, setOutputDir } from './settings.js'

const ROUTE_PREFIX = '/plugin-scaffold'
const MAX_BODY_BYTES = 64 * 1024
const MAX_MAKE_BODY_BYTES = 256 * 1024
const DSH_PROFILE_ROOT = join(homedir(), '.dsh', 'profiles')

function composePrompt(requirement, templateHint, referenceText) {
  const hint = templateHint && templateHint !== 'auto' ? `（模板倾向：${templateHint}）` : ''
  const ref = referenceText ? `\n\n附参考文件内容（节选，已由页面读取）：\n<<<\n${referenceText}\n>>>` : ''
  // capability（能力固化）追加保真要求：差距主要来自示例缩水、skill 没收录原始产出全文、
  // 校验规则不具体、渲染退化成摘要——这几点要在源头钉死
  const fidelity = templateHint === 'capability'
    ? '\n\n本次是能力固化：目标是让生成的插件在同类需求下稳定复现源会话最终结果的同等质量与格式。硬性要求：① assets/examples.json 收录「需求原文 → 最终结果完整原文」对照对，output 必须完整原文，禁止摘要/改写/缩水；capture 返回 truncated=true 时重跑并传更大 maxResultBytes（如 60000）直到拿到全文；② assets/skill.md 把原始产出全文收进「原始标杆产出」一节作质量标杆，步骤可复现、产出契约可机器检查；③ checkContract 规则从原始产出提炼（必备章节/字段、长度下限、关键内容特征）；④ 渲染输出与原始产出同构（原作 HTML 就渲染 HTML，不得退化成 Markdown 摘要）；⑤ 交付前用 examples 的输入重放 validate→render 自验收。'
    : ''
  return `请使用 make-dsh-plugin 技能制作一个 dsh 插件：${requirement}${hint}。先向我确认计划，确认后再开始生成。${ref}${fidelity}`
}

function readJsonBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('JSON 解析失败'))
      }
    })
    req.on('error', reject)
  })
}

// 当前 profile 的运行时插件表：moduleName（包名）→ 运行时条目。
async function runtimeEntries(ctx) {
  const pm = ctx.get('pluginManager')
  if (!pm) return null
  try {
    const entries = await pm.listPlugins()
    const byName = new Map()
    for (const entry of entries) byName.set(entry.moduleName, entry)
    return byName
  } catch {
    return null
  }
}

// PluginManager ChangeResult → 页面可展示的 JSON
function changeBody(r) {
  return {
    ok: r.application !== 'failed' && r.application !== 'cancelled',
    changed: !!r.changed,
    application: r.application,
    enabled: r.enabled,
    error: r.error?.code,
    diagnostic: r.error?.diagnostic,
    warnings: r.warnings,
  }
}

// 扫描 ~/.dsh/profiles 下的 profile 名；current = process 运行时所在的 profile（profileContext.name）
function listProfiles(ctx) {
  const all = []
  try {
    for (const name of readdirSync(DSH_PROFILE_ROOT)) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      if (existsSync(join(DSH_PROFILE_ROOT, name, 'package.json'))) all.push(name)
    }
  } catch {}
  let current = null
  try {
    current = ctx.get('profileContext')?.name ?? null
  } catch {}
  return { current, all: all.sort() }
}

// 把插件目录打包成 zip（排除 node_modules），写到 <outputRoot>/_exports/
function exportPlugin(pluginDir, outputRoot) {
  const pkg = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'))
  const id = String(pkg?.name ?? dirname(pluginDir))
  const targetDir = join(outputRoot, '_exports')
  mkdirSync(targetDir, { recursive: true })
  const zipPath = join(targetDir, `${id}-${pkg?.version ?? '0.0.0'}.zip`)
  const run = spawnSync('zip', ['-qr', zipPath, '.', '-x', 'node_modules/*', '*.zip'], {
    cwd: pluginDir, encoding: 'utf8', timeout: 60_000,
  })
  if (run.status !== 0) {
    throw new Error(String(run.stderr || '').split('\n')[0] || `zip 失败（status ${run.status}）`)
  }
  return zipPath
}

export function registerScaffoldPage(ctx, config) {
  // CSRF token：随机生成，经 index 注入给同源的浏览器页面，跨站攻击者读不到
  const token = randomBytes(24).toString('base64url')
  let disposeRoute
  let disposeTap
  let disposeRule

  const tryMount = () => {
    if (disposeRoute) return // 已挂载（不处理服务反复起伏的极端情况）
    const webServer = ctx.get('webServer')
    const webhookRuntime = ctx.get('webhookRuntime')
    if (!webServer || !webhookRuntime) return

    // 规则：把制作请求变成一个新会话；workspace 用用户设置的输出目录
    disposeRule = webhookRuntime.register({
      id: 'plugin-scaffold/make',
      kind: 'scaffold',
      run: (delivery) => {
        const event = delivery.event ?? {}
        const requirement = String(event.requirement ?? '').trim()
        if (!requirement) return null
        return {
          workspacePath: getOutputDir(config.outputDir),
          title: `制作插件：${requirement.slice(0, 30)}`,
          prompt: composePrompt(requirement.slice(0, 2000), String(event.templateHint ?? ''), String(event.referenceText ?? '').slice(0, 60000)),
          agentPreset: 'standard',
          permissionPreset: 'workspace-write',
        }
      },
    })

    disposeRoute = webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: async (req, res) => {
        const respond = (code, body) => {
          res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify(body))
        }
        try {
          if (req.headers['x-plugin-scaffold-token'] !== token) return respond(403, { error: 'forbidden' })
          const url = new URL(req.url, 'http://dsh.invalid')
          const path = url.pathname

          // 设置：读
          if (path === `${ROUTE_PREFIX}/settings` && req.method === 'GET') {
            return respond(200, { outputDir: getOutputDir(config.outputDir) })
          }
          // 设置：写（输出目录）
          if (path === `${ROUTE_PREFIX}/settings` && req.method === 'POST') {
            const body = await readJsonBody(req, MAX_BODY_BYTES)
            const outputDir = setOutputDir(body?.outputDir ?? '')
            return respond(200, { ok: true, outputDir })
          }
          // 插件列表：扫描输出目录，附当前 profile 运行时状态（未安装/已启用/已禁用/未激活）
          if (path === `${ROUTE_PREFIX}/list` && req.method === 'GET') {
            const plugins = listPlugins(getOutputDir(config.outputDir))
            const runtime = await runtimeEntries(ctx)
            for (const plugin of plugins) {
              const entry = runtime?.get(plugin.name)
              plugin.status = entry
                ? {
                    installed: true,
                    enabled: !!entry.enabled,
                    active: entry.fiberPhase === 'active',
                    fiberPhase: entry.fiberPhase ?? null,
                    entryId: String(entry.entryId),
                  }
                : { installed: false, active: false }
            }
            return respond(200, { outputDir: getOutputDir(config.outputDir), plugins, managerAvailable: runtime != null })
          }
          // profile 列表（多 profile 安装选择用）
          if (path === `${ROUTE_PREFIX}/profiles` && req.method === 'GET') {
            return respond(200, listProfiles(ctx))
          }
          // 激活预检：装依赖 → import → apply（安装前先在页面暴露 schema 错误）
          if (path === `${ROUTE_PREFIX}/check` && req.method === 'POST') {
            const body = await readJsonBody(req, MAX_BODY_BYTES)
            const target = String(body?.path ?? '').trim()
            if (!target) return respond(400, { error: 'path 必填' })
            const r = await activationDryRun(target)
            return respond(200, r)
          }
          // 安装：把输出目录下的插件装进当前 profile（依赖先装 → installBundle 激活）
          if (path === `${ROUTE_PREFIX}/install` && req.method === 'POST') {
            const pm = ctx.get('pluginManager')
            if (!pm) return respond(409, { error: 'plugin-manager-unavailable' })
            const body = await readJsonBody(req, MAX_BODY_BYTES)
            const target = String(body?.path ?? '').trim()
            if (!target) return respond(400, { error: 'path 必填' })
            ensurePluginDeps(target)
            const result = await pm.installBundle(target)
            return respond(200, changeBody(result))
          }
          // 更新：改代码后重装依赖并重新激活（toggle bundle 让 runtime 重新 import 链接源）
          if (path === `${ROUTE_PREFIX}/update` && req.method === 'POST') {
            const pm = ctx.get('pluginManager')
            if (!pm) return respond(409, { error: 'plugin-manager-unavailable' })
            const body = await readJsonBody(req, MAX_BODY_BYTES)
            const target = String(body?.path ?? '').trim()
            if (!target) return respond(400, { error: 'path 必填' })
            const pkgName = readPluginPackage(target)?.name
            if (!pkgName) return respond(400, { error: 'package.json 缺 name' })
            ensurePluginDeps(target)
            const off = await pm.setBundleEnabled(pkgName, false)
            const on = await pm.setBundleEnabled(pkgName, true)
            return respond(200, changeBody(on))
          }
          // 卸载：从当前 profile 移除插件包
          if (path === `${ROUTE_PREFIX}/remove` && req.method === 'POST') {
            const pm = ctx.get('pluginManager')
            if (!pm) return respond(409, { error: 'plugin-manager-unavailable' })
            const body = await readJsonBody(req, MAX_BODY_BYTES)
            const name = String(body?.name ?? '').trim()
            if (!name) return respond(400, { error: 'name 必填' })
            const result = await pm.removeBundle(name)
            return respond(200, changeBody(result))
          }
          // 启用 / 禁用：改运行时条目
          if (path === `${ROUTE_PREFIX}/set-enabled` && req.method === 'POST') {
            const pm = ctx.get('pluginManager')
            if (!pm) return respond(409, { error: 'plugin-manager-unavailable' })
            const body = await readJsonBody(req, MAX_BODY_BYTES)
            const entryId = String(body?.entryId ?? '')
            const enabled = !!body?.enabled
            if (!entryId) return respond(400, { error: 'entryId 必填' })
            const result = await pm.setPluginEnabled(entryId, enabled)
            return respond(200, changeBody(result))
          }
          // 导出：打包 zip（排除 node_modules）到 <输出目录>/_exports/
          if (path === `${ROUTE_PREFIX}/export` && req.method === 'POST') {
            const body = await readJsonBody(req, MAX_BODY_BYTES)
            const target = String(body?.path ?? '').trim()
            if (!target || !existsSync(join(target, 'package.json'))) return respond(400, { error: 'path 无效' })
            const zipPath = exportPlugin(target, getOutputDir(config.outputDir))
            return respond(200, { ok: true, zipPath })
          }
          // 下载刚导出的 zip（token 走 header，浏览器端 fetch→blob→保存）
          if (path === `${ROUTE_PREFIX}/download` && req.method === 'GET') {
            const file = decodeURIComponent(url.searchParams.get('file') ?? '')
            // 只允许下载 _exports/ 下的 zip，防路径逃逸
            const exportsDir = join(getOutputDir(config.outputDir), '_exports')
            if (!file.startsWith(exportsDir) || !existsSync(file)) return respond(404, { error: '文件不存在' })
            const buf = readFileSync(file)
            res.writeHead(200, {
              'content-type': 'application/zip',
              'content-disposition': `attachment; filename="${encodeURIComponent(file.split('/').pop())}"`,
              'content-length': buf.length,
            })
            return res.end(buf)
          }
          // 制作（参考文件可多选，正文按 6 万字符封顶，UTF-8 最坏 ~180KB → 放宽 body 上限）
          if (path === `${ROUTE_PREFIX}/make` && req.method === 'POST') {
            const body = await readJsonBody(req, MAX_MAKE_BODY_BYTES)
            const requirement = String(body?.requirement ?? '').trim()
            if (!requirement) return respond(400, { error: 'requirement 必填' })
            webhookRuntime.dispatch({
              kind: 'scaffold',
              source: 'plugin-scaffold',
              deliveryId: `make-${Date.now()}-${randomBytes(4).toString('hex')}`,
              event: {
                requirement: requirement.slice(0, 2000),
                templateHint: String(body?.templateHint ?? ''),
                referenceText: String(body?.referenceText ?? '').slice(0, 60000),
              },
              receivedAt: Date.now(),
            })
            // fire-and-forget：会话创建由 webhookRuntime 异步完成
            return respond(202, { ok: true })
          }
          return respond(404, { error: `unknown: ${req.method} ${path}` })
        } catch (e) {
          const msg = String(e?.message ?? e)
          // macOS TCC：运行 dsh 的终端应用未获「下载/桌面/文稿」文件夹权限时 fs 操作以 EPERM/EACCES 失败
          const hint = /EPERM|EACCES/i.test(msg)
            ? `${msg}；macOS 已拦截对该目录的访问：请在「系统设置 → 隐私与安全性 → 文件与文件夹」中允许运行 dsh 的终端应用访问此位置（或改用主目录下的文件夹），然后重试`
            : msg
          return respond(500, { error: hint })
        }
      },
    })

    // 把 token 作为 global 行注入 index（结构化注入表，等价于 boot 图注入，不依赖 tapIndex 时机）
    disposeTap = ctx.on('webserver/index-inject', (table) => {
      table.push({ kind: 'global', name: '__PLUGIN_SCAFFOLD_TOKEN__', value: token })
    })

    ctx.logger.info(`plugin-scaffold：制作插件页面已挂载（${ROUTE_PREFIX}/*）`)
  }

  tryMount()
  // 服务晚于本插件装载时补挂（webhookRuntime 在 Workspace 注册表之后才激活）
  ctx.on('internal/service', tryMount)

  ctx.effect(() => () => {
    disposeRule?.()
    disposeRoute?.()
    disposeTap?.()
  }, 'plugin-scaffold: page teardown')
}