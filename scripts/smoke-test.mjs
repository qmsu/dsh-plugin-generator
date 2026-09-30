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

// toolkit 模板：fixture 覆盖 stdio + streamable-http + 编排 skill
const toolkitPlan = {
  pluginId: 'dev-toolkit',
  packageName: 'dsh-dev-toolkit',
  description: '开发常用 MCP 套件',
  template: 'toolkit',
  tools: [],
  events: [],
  dependencies: [],
  mcp: [
    { serverName: 'github', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_TOKEN: '' } },
    { serverName: 'browser', transport: 'streamable-http', url: 'http://127.0.0.1:3000/mcp', headers: {} },
  ],
  skills: [{ name: 'dev-flow', description: '用 GitHub + 浏览器 MCP 完成开发任务', whenToUse: '用户要做仓库相关任务时' }],
}
{
  const files = TEMPLATES.toolkit(toolkitPlan)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, 'toolkit', rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
    if (rel.endsWith('.js')) execFileSync(process.execPath, ['--check', abs])
    if (rel === 'cordis.patch.yml') {
      if (!content.includes('@deepseek-ai/dsh-mcp-client')) throw new Error('toolkit patch 缺 mcp-client 行')
      if (!content.includes('serverName: github') || !content.includes('serverName: browser')) throw new Error('toolkit patch 缺 MCP server 配置')
    }
  }
  console.log('toolkit', 'OK:', Object.keys(files).join(', '))
}
console.log('smoke dir:', dir)
