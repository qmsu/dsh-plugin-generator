import { TEMPLATES } from '../src/templates/index.js'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'

const plan = {
  pluginId: 'excel-to-markdown',
  packageName: 'dsh-excel-to-markdown',
  description: '把 Excel 转成 Markdown',
  template: 'file',
  tools: [{ name: 'excel_to_markdown', description: 'xlsx 转 markdown', params: [{ name: 'file_path', type: 'string', description: 'xlsx 路径' }], returns: 'md' }],
  events: [],
  dependencies: ['exceljs'],
}
const dir = mkdtempSync(join(process.cwd(), '.smoke-'))
for (const tpl of ['tool', 'events', 'file', 'capability']) {
  const files = TEMPLATES[tpl](plan)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, tpl, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
    if (rel.endsWith('.js')) execFileSync(process.execPath, ['--check', abs])
    if (rel === 'package.json') { const p = JSON.parse(content); if (!p.dsh?.bundle?.patch) throw new Error('bundle patch missing') }
  }
  console.log(tpl, 'OK:', Object.keys(files).join(', '))
}
console.log('smoke dir:', dir)
