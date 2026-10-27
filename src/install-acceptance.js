// 安装验收：调用 dsh 真实 plugin_manager，并要求目标插件在当前运行时实际激活。
// 只看 pnpm 退出码或 application=applied 不够——inject/服务缺失会让 bundle 装上但条目 pending。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { activationDryRun, readPluginPackage } from './activation.js'

export function profilePackageManager(ctx) {
  try {
    return ctx.get?.('profileContext')?.packageManager ?? null
  } catch {
    return null
  }
}

function short(text) {
  return String(text ?? '').trim().slice(-800)
}

function pluginEntryIds(pluginDir, pkg) {
  const patch = pkg?.dsh?.bundle?.patch
  const files = Array.isArray(patch) ? patch : [patch]
  const ids = []
  for (const file of files.filter(Boolean)) {
    try {
      const text = readFileSync(join(pluginDir, String(file)), 'utf8')
      for (const match of text.matchAll(/^\s*-?\s*id:\s*['"]?([^'"\n#]+)['"]?\s*$/gm)) {
        ids.push(match[1].trim())
      }
    } catch {}
  }
  return [...new Set(ids)]
}

function targetWarnings(result, pkg, entryIds) {
  const terms = [pkg.name, ...entryIds].filter(Boolean)
  return (result.warnings ?? []).filter((warning) => {
    const text = String(warning)
    return /did not activate|pending|failed/i.test(text) && terms.some((term) => text.includes(term))
  })
}

async function runtimeEntry(pm, packageName) {
  try {
    const entries = await pm.listPlugins()
    return entries.find((entry) => entry.moduleName === packageName) ?? null
  } catch (e) {
    return { fiberPhase: 'unknown', listError: String(e?.message ?? e) }
  }
}

/**
 * 真实安装并验收激活。返回值保留 ChangeResult 字段，另加 ok / pluginName / active / fiberPhase。
 * restart-required 不算验收通过：生成器交付的是“现在可用”的插件，而不是等待重启的半成品。
 */
export async function installPluginWithAcceptance(ctx, pluginDir) {
  const pkg = readPluginPackage(pluginDir)
  if (!pkg?.name) throw new Error('package.json 缺 name')
  const pm = ctx.get('pluginManager')
  if (!pm) throw new Error('当前环境没有 plugin_manager 服务，无法自动安装')

  const preflight = await activationDryRun(pluginDir, profilePackageManager(ctx))
  if (!preflight.ok) {
    return {
      ok: false,
      application: 'failed',
      stage: 'install',
      target: pkg.name,
      pluginName: pkg.name,
      diagnostic: `激活预检失败：${preflight.error}`,
      warnings: [],
      active: false,
      restartRequired: false,
    }
  }

  const result = await pm.installBundle(pluginDir)
  const entry = await runtimeEntry(pm, pkg.name)
  const ids = pluginEntryIds(pluginDir, pkg)
  const warnings = targetWarnings(result, pkg, ids)
  const baseOk = result.application !== 'failed' && result.application !== 'cancelled'
  const active = result.application === 'applied' && entry?.fiberPhase === 'active'
  const ok = baseOk && active && warnings.length === 0

  let diagnostic = result.error?.diagnostic ?? result.error?.code
  if (!ok && !diagnostic) {
    if (warnings.length) diagnostic = warnings.join('\n')
    else if (result.application === 'restart-required') diagnostic = `插件已安装但当前 profile 需要重启后激活（${result.restartReason ?? 'unknown'}）`
    else if (entry?.listError) diagnostic = `无法读取运行时插件表：${entry.listError}`
    else if (entry) diagnostic = `插件已安装但未激活（fiberPhase: ${entry.fiberPhase ?? 'unknown'}）`
    else diagnostic = '插件已安装但运行时插件表中未找到目标条目'
  }

  return {
    ...result,
    ok,
    pluginName: pkg.name,
    diagnostic: short(diagnostic),
    warnings,
    active,
    fiberPhase: entry?.fiberPhase,
    restartRequired: result.application === 'restart-required',
  }
}
