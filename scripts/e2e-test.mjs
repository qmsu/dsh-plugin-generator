// 端到端冒烟：mock ctx 捕获工具注册，跑 plan → create → write_file → validate → package 全链路。
import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerScaffoldTools } from '../src/tools/index.js'

const dir = mkdtempSync(join('/Users/zg/Documents/fnsync/息壤/xirang-code/dsh-plugin-generator/', '.e2e-'))

// mock cordis ctx：捕获 defineTool 定义
const registered = new Map()
const ctx = {
  logger: { info: () => {} },
  tools: {
    register(def) {
      registered.set(def.name, def)
      return () => registered.delete(def.name)
    },
  },
}
const config = {
  outputDir: dir,
  maxFileBytes: 100_000,
  zipMaxBytes: 20 * 1024 * 1024,
  allowedDependencies: ['exceljs', 'pdfjs-dist', 'mammoth', 'papaparse', 'yaml', 'marked'],
}
registerScaffoldTools(ctx, config)

const exec = { signal: AbortSignal.timeout(30_000) }
const call = async (name, args) => {
  const def = registered.get(name)
  if (!def) throw new Error(`tool not registered: ${name}`)
  return def.execute(args, exec)
}

// 1) plan（草案故意带毛病：大写 id、非法模板、白名单外依赖）
const plan = await call('scaffold_plan', {
  requirement: '做一个把 Excel 批量转 Markdown 的插件',
  plan: {
    pluginId: 'Excel To MD!!',
    template: 'file',
    description: '把 Excel 转成 Markdown 表格',
    tools: [{ name: 'excel-to-md', description: 'xlsx 转 markdown', params: [{ name: 'file_path', type: 'string', description: 'xlsx 路径' }] }],
    dependencies: ['exceljs', 'lodash'],
  },
})
console.log('plan:', plan.pluginId, plan.packageName, 'deps=', plan.dependencies, 'warnings=', plan.warnings.length)
if (plan.pluginId !== 'excel-to-md') throw new Error('kebab 规范化失败')
if (plan.dependencies.includes('lodash')) throw new Error('白名单失效')

// 1b) 用户批准后可放行白名单外依赖
const plan2 = await call('scaffold_plan', {
  requirement: '做一个 Excel 转换插件',
  plan: { pluginId: 'excel-x', template: 'tool', dependencies: ['xlsx', 'lodash'] },
  approvedDependencies: ['xlsx'],
})
if (!plan2.dependencies.includes('xlsx') || plan2.dependencies.includes('lodash')) throw new Error('approvedDependencies 逻辑失效')
console.log('approvedDependencies OK:', plan2.dependencies.join(','))

// 2) create
const created = await call('scaffold_create', { plan })
console.log('create:', created.pluginDir, created.files.join(','))

// 3) write_file：写业务实现 + 越界路径必须被拒
const impl = readFileSync(join(created.pluginDir, 'src/index.js'), 'utf8')
  .replace("const result = '已读取 ' + basename(abs) + '（解析逻辑待实现）'", "const result = '已读取 ' + basename(abs)")
await call('scaffold_write_file', { pluginDir: created.pluginDir, path: 'src/index.js', content: impl, overwrite: true })
let escaped = false
try {
  await call('scaffold_write_file', { pluginDir: created.pluginDir, path: '../evil.js', content: 'x', overwrite: true })
} catch { escaped = true }
if (!escaped) throw new Error('路径防逃逸失效')

// 4) validate
const v = await call('scaffold_validate', { pluginDir: created.pluginDir })
console.log('validate ok=', v.ok, 'errors=', v.errors, 'warnings=', v.warnings)

// 5) package
const p = await call('scaffold_package', { pluginDir: created.pluginDir })
console.log('package:', p.zipPath, (p.sizeBytes / 1024).toFixed(1) + 'KB')
console.log(p.installCommands.join(' | '))

console.log('E2E OK, dir =', dir)
