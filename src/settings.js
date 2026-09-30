// 「制作插件」的宿主侧设置与插件列表。
// 设置持久化在 ~/.dsh/plugin-scaffold-settings.json，页面与 scaffold_* 工具共享。
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const SETTINGS_PATH = join(homedir(), '.dsh', 'plugin-scaffold-settings.json')

let cache

function load() {
  if (cache === undefined) {
    try {
      cache = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'))
    } catch {
      cache = {}
    }
  }
  return cache
}

function save() {
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true })
  writeFileSync(SETTINGS_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf8')
}

/** 当前输出目录：用户设置优先，未设置时用插件配置的默认值。 */
export function getOutputDir(fallback) {
  return load().outputDir ?? fallback
}

/** 设置输出目录：解析为绝对路径并确保存在。 */
export function setOutputDir(dir) {
  const abs = resolve(String(dir ?? '').trim())
  if (!abs || abs === resolve('/')) throw new Error('非法目录')
  mkdirSync(abs, { recursive: true })
  cache = { ...load(), outputDir: abs }
  save()
  return abs
}

/**
 * 罗列输出目录下自制插件：每个子目录若含合法 package.json（带 dsh.bundle.patch）即一条。
 * 返回按目录名排序；invalid 的目录也列出（带原因），方便用户清理半成品。
 */
export function listPlugins(outputDir) {
  if (!existsSync(outputDir)) return []
  const entries = []
  for (const name of readdirSync(outputDir).sort()) {
    const dir = join(outputDir, name)
    if (!existsSync(join(dir, 'package.json'))) continue
    const entry = { id: name, path: dir, name, version: '', description: '', ok: false, problems: [] }
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      entry.name = pkg.name ?? name
      entry.version = pkg.version ?? ''
      entry.description = pkg.description ?? ''
      if (!pkg.dsh?.bundle?.patch) entry.problems.push('缺 dsh.bundle.patch 声明')
      if (!pkg.main) entry.problems.push('缺入口 main')
      entry.ok = entry.problems.length === 0
    } catch (e) {
      entry.problems.push(`package.json 解析失败: ${e.message}`)
    }
    entries.push(entry)
  }
  return entries
}
