// 生成插件的模板集合。每个模板是一个 render(plan) → { 相对路径: 文件内容 } 的函数。
// 模板保证包结构 100% 合法（manifest/patch/入口样板），模型只往里填业务逻辑。
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

// dsh 安装插件时的 peer 版本兼容检查：拿 manifest 里 @deepseek-ai/dsh* 的 peer 范围
// 和「正在运行的宿主 dsh」版本做 semver 比对，不满足即拒绝安装（incompatible-version）。
// 所以这里必须钉「当前正在跑我们的那个 dsh」的版本，而不是本仓库 node_modules 里的
// dsh-tools 版本——后者只反映开发机装包时的版本，用户用 npx @latest 跑更新的 dsh 时会错位。
function resolveRuntimeDshVersion() {
  // 宿主 dsh 的入口脚本（npx 缓存 / 全局安装均为 <root>/node_modules/.bin/dsh）
  try {
    const bin = process.argv[1]
    if (bin) {
      const bootPkg = join(dirname(bin), '..', '@deepseek-ai', 'dsh-app-boot', 'package.json')
      return JSON.parse(readFileSync(bootPkg, 'utf8')).version
    }
  } catch {}
  // 兜底：本仓库 node_modules 里的 dsh-tools 版本
  try {
    return require('@deepseek-ai/dsh-tools/package.json').version
  } catch {}
  return null
}

// caret 范围：满足当前宿主，且允许同 minor 的补丁升级（检查器带 includePrerelease）
let DSH_PEER_RANGE = '*'
{
  const runtimeVersion = resolveRuntimeDshVersion()
  if (runtimeVersion) DSH_PEER_RANGE = `^${runtimeVersion}`
}

function pkg(plan) {
  const deps = Object.fromEntries(plan.dependencies.map((d) => {
    const version = { exceljs: '^4.4.0', xlsx: '^0.18.5', mammoth: '^1.8.0', 'pdfjs-dist': '^4.0.0', papaparse: '^5.4.0', yaml: '^2.5.0', marked: '^12.0.0' }
    return [d, version[d] ?? '^1.0.0']
  }))
  return `${JSON.stringify({
    name: plan.packageName,
    version: '0.1.0',
    description: plan.description,
    type: 'module',
    main: 'src/index.js',
    exports: {
      '.': './src/index.js',
      './cordis.patch.yml': './cordis.patch.yml',
      './package.json': './package.json',
    },
    dsh: { bundle: { patch: './cordis.patch.yml' } },
    ...(Object.keys(deps).length ? { dependencies: deps } : {}),
    peerDependencies: {
      '@deepseek-ai/dsh-tools': DSH_PEER_RANGE,
      '@deepseek-ai/schemastery': '*',
    },
    license: 'MIT',
  }, null, 2)}\n`
}

function patch(plan) {
  return `# ${plan.packageName} 的 bundle patch：把插件挂进 profile。
- insert:
    - id: ${plan.pluginId}
      name: '${plan.packageName}'
`
}

function paramsSchema(params) {
  // 计划里的 params 简述展开成 defineTool 的 parameters spec
  const lines = params.map((p) => {
    const type = ({ string: 'string', number: 'number', integer: 'integer', boolean: 'boolean', json: 'json' })[p.type] ?? 'string'
    return `      ${p.name}: {\n        type: '${type}',\n        required: true,\n        description: '${String(p.description ?? '').replace(/'/g, "\\'")}',\n      },`
  })
  return lines.length ? lines.join('\n') : `      input: {\n        type: 'string',\n        required: true,\n        description: '待处理的内容',\n      },`
}

/** tool 模板：给模型注册一个可调用的工具。 */
function renderTool(plan) {
  const tool = plan.tools[0]
  const others = plan.tools.slice(1)
  const toolName = tool.name
  const registerMore = others.map((t) => `
// TODO: 按计划完善第 2+ 个工具「${t.name}」：${t.description}
// ctx.tools.register(defineTool({ name: '${t.name}', ... }))`).join('\n')

  return {
    'package.json': pkg(plan),
    'cordis.patch.yml': patch(plan),
    'README.md': `# ${plan.packageName}\n\n${plan.description}\n\n## 安装\n\n\`\`\`bash\ndsh plugin --profile <profile> add <本目录>\n\`\`\`\n`,
    'src/index.js': `// ${plan.packageName}：${plan.description}
// 由 dsh-plugin-generator 生成（tool 模板）。运行环境为 dsh host，纯 ESM 免构建。
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = '${plan.pluginId}'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: '${toolName}',
    description: '${tool.description.replace(/'/g, "\\'") || plan.description}',
    parameters: {
${paramsSchema(tool.params)}
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          result: { type: 'string', required: true },
        },
      },
      render: (args, value) => [{ type: 'text', text: value.result }],
    },
    execute: async (args, exec) => {
      // TODO: 实现 ${tool.description || '工具逻辑'}；返回对象必须匹配 output.schema
      return { result: '收到: ' + JSON.stringify(args) }
    },
  }))
${registerMore}
}
`,
  }
}

/** events 模板：监听会话生命周期事件，不注册工具。 */
function renderEvents(plan) {
  const events = plan.events.length ? plan.events : ['turn/end']
  const listeners = events.map((e) => `  ctx.on('${e}', (payload) => {
    // TODO: 处理 ${e}：payload 结构可用 dsh 的 cordis_inspect 工具查询
    ctx.logger.info('${plan.pluginId} 收到 ${e}')
  })`).join('\n\n')

  return {
    'package.json': pkg(plan),
    'cordis.patch.yml': patch(plan),
    'README.md': `# ${plan.packageName}\n\n${plan.description}\n\n监听事件：${events.join(', ')}\n`,
    'src/index.js': `// ${plan.packageName}：${plan.description}
// 由 dsh-plugin-generator 生成（events 模板）。
export const name = '${plan.pluginId}'
export const inject = []

export function apply(ctx) {
${listeners}
}
`,
  }
}

/** file 模板：tool 模板 + 文件处理骨架（读取输入文件、写出产物、回报路径）。 */
function renderFile(plan) {
  const files = renderTool(plan)
  const tool = plan.tools[0]
  const usesExcel = plan.dependencies.includes('exceljs')
  const usesMammoth = plan.dependencies.includes('mammoth')

  files['src/index.js'] = `// ${plan.packageName}：${plan.description}
// 由 dsh-plugin-generator 生成（file 模板：带文件处理骨架）。
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = '${plan.pluginId}'
export const inject = ['tools']

// 文件处理三件套：读入（类型识别）→ 解析 → 写出并回报路径
async function readInput(filePath, signal) {
  const abs = resolve(filePath)
  const buf = await readFile(abs, { signal })
  return { abs, buf, ext: abs.split('.').pop()?.toLowerCase() ?? '' }
}

async function writeOutput(dir, name, content) {
  await mkdir(dir, { recursive: true })
  const outPath = join(dir, name)
  await writeFile(outPath, content, 'utf8')
  return outPath
}

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: '${tool.name}',
    description: '${tool.description.replace(/'/g, "\\'") || plan.description}',
    parameters: {
      file_path: {
        type: 'string',
        required: true,
        description: '输入文件路径',
      },
      out_dir: {
        type: 'string',
        description: '产物输出目录，默认 <输入文件同目录>/output',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          result: { type: 'string', required: true },
          outPath: { type: 'string' },
        },
      },
      render: (args, value) => [{ type: 'text', text: \`\${value.result}\${value.outPath ? '\\n产物: ' + value.outPath : ''}\` }],
    },
    execute: async (args, exec) => {
      const { abs, buf, ext } = await readInput(args.file_path, exec.signal)
      const outDir = args.out_dir ?? join(abs, '..', 'output')

      // TODO: 按扩展名解析。常用解析库（需在 package.json dependencies 声明）：
${usesExcel ? `      // exceljs: const ExcelJS = await import('exceljs'); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf)` : '      // exceljs: Excel 解析（xlsx/xls）'}
${usesMammoth ? `      // mammoth: const mammoth = await import('mammoth'); const { value } = await mammoth.convertToMarkdown({ buffer: buf })` : '      // mammoth: Word 转 Markdown（docx）'}
      // papaparse: CSV 解析；yaml/marked 同理按需引入
      void buf; void ext

      const result = '已读取 ' + basename(abs) + '（解析逻辑待实现）'
      return { result }
    },
  }))
}
`
  return files
}

/**
 * capability 模板：把"一次成功会话的能力"固化成插件。
 * 架构 = skill（静态规矩：步骤/规则/产出契约/少样本示例）+ 确定性工具（校验/渲染）。
 * 稳定性来自三层：skill 文本钉死"做什么"，示例钉死"做到什么程度"，
 * 校验工具把模型产出的随机性压缩到最小（校验不过 → 按机器反馈修复 → 确定性渲染）。
 */
function renderCapability(plan) {
  const toolPrefix = plan.pluginId.replace(/-/g, '_')
  const desc = String(plan.description ?? '').replace(/'/g, "\\'")

  return {
    'package.json': pkg(plan),
    'cordis.patch.yml': patch(plan),
    'README.md': `# ${plan.packageName}\n\n${plan.description}\n\n「能力固化」插件：skill 提供步骤/规则/产出契约/少样本示例，${toolPrefix}_validate 机器校验候选产出，${toolPrefix}_render 确定性渲染最终结果。\n\n## 安装\n\n\`\`\`bash\ndsh plugin --profile <profile> add <本目录>\n\`\`\`\n\n## 使用\n\n在会话里描述需求（与 skill 的 whenToUse 匹配时模型会自动加载），或明确要求使用技能「${plan.pluginId}」。按 skill 步骤产出中间结构 → 用 ${toolPrefix}_validate 校验 → 通过后 ${toolPrefix}_render 渲染最终结果。\n`,
    'assets/skill.md': `# ${plan.description}\n\n<!-- 由生成会话用 scaffold_write_file 填充：把"当时是怎么做的"蒸馏成可复现的步骤、规则与产出契约。模型运行时会加载本技能严格照做。 -->\n\n## 适用场景\n\n<!-- 什么输入适合用本能力；不适用的情形也要写清楚，防止模型误路由 -->\n\n## 原始标杆产出\n\n<!-- 核心节：把源会话最终结果的完整原文贴在这里（不得摘要/缩水），它是质量标杆——运行时对照它决定"做到什么程度"。原文太长时至少完整保留结构与全部关键内容 -->\n\n## 步骤\n\n1. （第 1 步做什么）\n2. （第 2 步做什么）\n3. 产出中间结构（JSON，按原始标杆产出的结构切块），交给 ${toolPrefix}_validate 校验\n4. 校验不通过时按返回的逐条错误修复，重新校验（最多 3 轮）\n5. 校验通过后交给 ${toolPrefix}_render 渲染最终结果（渲染输出必须与原始标杆产出同构：原作 HTML 就渲染 HTML，不得退化成摘要）\n\n## 产出契约\n\n<!-- 中间结构必须满足的字段/格式/质量要求（validate 工具里的规则要与这里一致） -->\n\n## 质量要点（从成功会话沉淀）\n\n<!-- 当时做对了什么：术语、格式偏好、样式约定、边界处理、禁忌 -->\n`,
    'assets/examples.json': `[]\n`,
    'src/harness.js': `// ${plan.packageName}：确定性助手（capability 模板的"手脚"部分，无模型参与，输出完全稳定）。
import { readFileSync } from 'node:fs'

export function loadSkill(path) {
  return readFileSync(path, 'utf8')
}

export function loadExamples(path) {
  try {
    const list = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

// 把少样本示例拼进技能正文（钉死"做到什么程度"）
export function formatExamples(examples) {
  if (examples.length === 0) return '（暂无示例）'
  return examples.map((ex, i) => {
    const input = typeof ex.input === 'string' ? ex.input : JSON.stringify(ex.input, null, 2)
    const output = typeof ex.output === 'string' ? ex.output : JSON.stringify(ex.output, null, 2)
    return \`### 示例 \${i + 1}\\n\\n输入：\\n\\\`\\\`\\\`\\n\${input}\\n\\\`\\\`\\\`\\n\\n产出（应达到的水准）：\\n\\\`\\\`\\\`\\n\${output}\\n\\\`\\\`\\\`\`
  }).join('\\n\\n')
}

// 产出契约校验：TODO 由生成会话把"产出契约"落实成具体规则（字段、格式、数值范围…）。
// 规则必须是确定性的（纯函数），模型只负责产出候选，合格与否由这里机器判定。
export function checkContract(candidate) {
  const errors = []
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    errors.push('产出必须是 JSON object')
    return { ok: false, errors, normalized: null }
  }
  const keys = Object.keys(candidate)
  if (keys.length === 0) errors.push('产出不能为空对象')
  for (const k of keys) {
    const v = candidate[k]
    if (v === null || v === undefined || v === '') errors.push(\`字段 \${k} 为空\`)
  }
  // TODO: 按 assets/skill.md 的"产出契约"增加具体规则
  return { ok: errors.length === 0, errors, normalized: errors.length === 0 ? candidate : null }
}

// 确定性渲染：中间结构 → 最终输出格式（Markdown 优先），消除模型自由发挥的最后一公里。
export function renderResult(data, format = 'markdown') {
  if (format === 'json') return JSON.stringify(data, null, 2)
  const lines = []
  for (const [k, v] of Object.entries(data)) {
    lines.push(\`## \${k}\`, '', typeof v === 'string' ? v : '\`\`\`json\\n' + JSON.stringify(v, null, 2) + '\\n\`\`\`', '')
  }
  return lines.join('\\n').trim()
}
`,
    'src/index.js': `// ${plan.packageName}：${plan.description}
// 由 dsh-plugin-generator 生成（capability 模板：skill 规矩 + 确定性手脚）。
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { checkContract, formatExamples, loadExamples, loadSkill, renderResult } from './harness.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const skillContent = loadSkill(join(root, 'assets', 'skill.md'))
const examples = loadExamples(join(root, 'assets', 'examples.json'))

export const name = '${plan.pluginId}'
export const inject = ['tools', 'skills']

export function apply(ctx) {
  // skill：静态文本，钉死"做什么/做到什么程度"，是稳定性的根基
  ctx.skills.register({
    name: '${plan.pluginId}',
    description: '${desc}',
    whenToUse: '${desc}',
    content: skillContent + '\\n\\n## 少样本示例（产出必须达到的水准）\\n\\n' + formatExamples(examples),
    source: 'runtime',
    invocation: { modelInvocable: true, userInvocable: true },
  })

  // 校验工具：机器判定候选产出是否符合契约，不通过给出逐条错误供模型自修复
  ctx.tools.register(defineTool({
    name: '${toolPrefix}_validate',
    description: '校验候选产出（中间结构 JSON）是否符合本插件的产出契约。返回 ok / 逐条错误 / 归一化后的产出。校验通过后再用 ${toolPrefix}_render 渲染最终结果。',
    parameters: {
      candidate: {
        type: 'json',
        required: true,
        description: '待校验的候选产出（中间结构）',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          errors: { type: 'array', required: true },
          normalized: { type: 'json' },
        },
      },
      render: (args, value) => [{ type: 'text', text: value.ok ? '校验通过' : '校验未通过：\\n' + value.errors.map((e) => '- ' + e).join('\\n') }],
    },
    execute: async (args, exec) => {
      exec.signal?.throwIfAborted()
      return checkContract(args.candidate)
    },
  }))

  // 渲染工具：中间结构 → 最终输出，纯确定性代码
  ctx.tools.register(defineTool({
    name: '${toolPrefix}_render',
    description: '把 ${toolPrefix}_validate 校验通过的中间结构确定性地渲染成最终输出（默认 Markdown）。',
    parameters: {
      data: {
        type: 'json',
        required: true,
        description: '校验通过的中间结构',
      },
      format: {
        type: 'string',
        description: '输出格式：markdown（默认）或 json',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          result: { type: 'string', required: true },
        },
      },
      render: (args, value) => [{ type: 'text', text: value.result }],
    },
    execute: async (args, exec) => {
      exec.signal?.throwIfAborted()
      return { result: renderResult(args.data, args.format ?? 'markdown') }
    },
  }))
}
`,
  }
}

export const TEMPLATES = {
  tool: renderTool,
  events: renderEvents,
  file: renderFile,
  capability: renderCapability,
  toolkit: renderToolkit,
}

// ---- toolkit 模板：把 N 个 MCP server + 编排 skill 打成一个 bundle，一键装一整套 ----

/** 极小 YAML 标量：安全词原样，其余单引号包裹（空串 → ''）。 */
function ystr(v) {
  const s = String(v ?? '')
  if (s === '') return "''"
  if (/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(s)) return s
  return `'${s.replace(/'/g, "''")}'`
}

/** 把 mcp-client 一行展开成 6 空格缩进的 config（env/headers 序列化成对象块）。 */
function mcpClientConfig(server, indent) {
  const pad = ' '.repeat(indent)
  const lines = [
    `serverName: ${ystr(server.serverName)}`,
    `transport: ${server.transport}`,
  ]
  if (server.transport === 'stdio') {
    lines.push(`command: ${ystr(server.command)}`)
    if (Array.isArray(server.args) && server.args.length) lines.push(`args: [${server.args.map(ystr).join(', ')}]`)
    const envKeys = Object.keys(server.env ?? {})
    if (envKeys.length) {
      lines.push('env:')
      for (const k of envKeys) lines.push(`  ${k}: ${ystr(server.env[k])}`)
    }
    if (server.cwd) lines.push(`cwd: ${ystr(server.cwd)}`)
  } else {
    lines.push(`url: ${ystr(server.url)}`)
    const headerKeys = Object.keys(server.headers ?? {})
    if (headerKeys.length) {
      lines.push('headers:')
      for (const k of headerKeys) lines.push(`  ${k}: ${ystr(server.headers[k])}`)
    }
  }
  lines.push('failOnStartupError: true')
  // indent 是 config 项的缩进层级；此处 lines 内层（env 的 k:v）还需再加缩进，上面手工拼了 2 空格，统一用 pad 对齐顶层行
  return lines.map((l) => `${pad}${l}`).join('\n')
}

function slugify(s) {
  const v = String(s ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
  return v || 'skill'
}

function renderToolkit(plan) {
  const mcpServers = Array.isArray(plan.mcp) ? plan.mcp : []
  const skills = Array.isArray(plan.skills) && plan.skills.length ? plan.skills : [{ name: plan.pluginId, description: plan.description, whenToUse: plan.description }]

  // 编排 skill 元数据（内联进 src/index.js），正文在 assets/skills/<slug>.md 由生成会话填充
  const skillMeta = skills.map((s, i) => {
    const rawName = String(s?.name ?? '').trim()
    return {
      name: rawName || plan.pluginId,
      description: String(s?.description ?? '').replace(/'/g, "\\'"),
      whenToUse: String(s?.whenToUse ?? s?.description ?? '').replace(/'/g, "\\'"),
      slug: slugify(rawName || `skill-${i}`),
    }
  })

  const skillFiles = {}
  for (const m of skillMeta) {
    const toolsHint = mcpServers.length
      ? mcpServers.map((srv) => `#### ${srv.serverName}（transport: ${srv.transport}）\n- 工具命名空间 \`mcp__${srv.serverName}__<tool>\`（连接后具体工具清单由工具描述提供）\n- 连接方式：${srv.transport === 'stdio' ? `\`${srv.command}${(srv.args ?? []).length ? ' ' + srv.args.join(' ') : ''}\`` : srv.url}`).join('\n')
      : '（本套件未声明 MCP server）'
    skillFiles[`assets/skills/${m.slug}.md`] = `# ${m.name}\n\n${m.description}\n\n<!-- 由生成会话用 scaffold_write_file 覆盖成可运行的编排说明：教模型这些工具分别是什么、什么场景、按什么顺序组合。 -->\n\n## 适用场景\n\n<!-- 什么输入适合用本套件；不适用的情形写清楚防止误路由 -->\n\n## 可用 MCP 工具\n\n${toolsHint}\n\n## 步骤与组合\n\n1. （第 1 步用哪个工具做什么）\n2. （第 2 步…）\n3. （收尾：产出结果 / 回报用户）\n`
  }

  const patchRows = [
    `    - id: ${plan.pluginId}\n      name: '${plan.packageName}'`,
    ...mcpServers.map((srv) => `    - id: ${plan.pluginId}-mcp-${srv.serverName}\n      name: '@deepseek-ai/dsh-mcp-client'\n      config:\n${mcpClientConfig(srv, 8)}`),
  ]

  const skillMetaJs = skillMeta.map((m) => `  { name: '${m.name}', description: '${m.description}', whenToUse: '${m.whenToUse}', file: 'assets/skills/${m.slug}.md' },`).join('\n')

  return {
    'package.json': `${JSON.stringify({
      name: plan.packageName,
      version: '0.1.0',
      description: plan.description,
      type: 'module',
      main: 'src/index.js',
      exports: {
        '.': './src/index.js',
        './cordis.patch.yml': './cordis.patch.yml',
        './package.json': './package.json',
      },
      dsh: { bundle: { patch: './cordis.patch.yml' } },
      license: 'MIT',
    }, null, 2)}\n`,
    'cordis.patch.yml': `# ${plan.packageName} 的 bundle patch：N 个 MCP server（@deepseek-ai/dsh-mcp-client）+ 编排 skill 插件。\n- insert:\n${patchRows.join('\n')}\n`,
    'README.md': `# ${plan.packageName}\n\n${plan.description}\n\n「能力套件（toolkit）」插件：一个 bundle 打包 N 个 MCP server + 编排 skill，一键安装、可复现。\n\n## 包含的 MCP server\n${mcpServers.map((srv) => `- **${srv.serverName}**（${srv.transport}）— ${srv.transport === 'stdio' ? `\`${srv.command}${(srv.args ?? []).length ? ' ' + srv.args.join(' ') : ''}\`` : srv.url}`).join('\n') || '（无）'}\n\n## 包含的 skill\n${skillMeta.map((m) => `- **${m.name}**：${m.description}`).join('\n')}\n\n## 安装\n\n\`\`\`bash\ndsh plugin --profile <profile> add <本目录>\n\`\`\`\n\n## 使用\n\n安装后新增 \`mcp__<serverName>__<tool>\` 命名空间的工具；编排 skill「${skillMeta.map((m) => m.name).join(' / ')}」在匹配场景自动加载。\n\n密钥：MCP 依赖的凭据通过环境变量 / 请求头注入（见 cordis.patch.yml 的 env / headers 键名），请自行 export 对应变量，切勿把 token 写进本目录的代码。\n`,
    'src/index.js': `// ${plan.packageName}：${plan.description}\n// 由 dsh-plugin-generator 生成（toolkit 模板：N 个 MCP server + 编排 skill）。\n// MCP server 在 cordis.patch.yml 里以 @deepseek-ai/dsh-mcp-client 挂载；这里只注册编排 skill。\nimport { readFileSync } from 'node:fs'\nimport { dirname, join } from 'node:path'\nimport { fileURLToPath } from 'node:url'\n\nconst root = join(dirname(fileURLToPath(import.meta.url)), '..')\n\nexport const name = '${plan.pluginId}'\nexport const inject = ['skills']\n\n// 编排 skill 元数据；正文在 assets/skills/<slug>.md（生成会话用 scaffold_write_file 填好）\nconst SKILLS = [\n${skillMetaJs}\n]\n\nexport function apply(ctx) {\n  for (const skill of SKILLS) {\n    let content = ''\n    try { content = readFileSync(join(root, skill.file), 'utf8') } catch {}\n    ctx.skills.register({\n      name: skill.name,\n      description: skill.description,\n      whenToUse: skill.whenToUse,\n      content,\n      source: 'runtime',\n      invocation: { modelInvocable: true, userInvocable: true },\n    })\n  }\n}\n`,
    ...skillFiles,
  }
}
