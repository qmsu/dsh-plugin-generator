// 真实挂载测试：用 dsh 官方 Cordis 运行时挂载 system-prompt / tools / skills 服务，再加载本插件，
// 验证 7 个 scaffold_* 工具与 make-dsh-plugin 技能真实注册成功（含 defineTool 注册期校验）。
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as scaffold from '../src/index.js'

const ctx = new Context()
await ctx.plugin(SystemPrompt)
await ctx.plugin(ToolRuntime)
await ctx.plugin(SkillRegistry)
// 与 profile 里 loader 挂载等价：导出 name/inject/Config/apply 的插件模块
await ctx.plugin(scaffold)

const names = ctx.tools.schemas().map((s) => s.name).filter((n) => n.startsWith('scaffold_'))
console.log('已注册工具:', names.join(', '))
if (names.length !== 9) throw new Error(`应有 9 个 scaffold_* 工具，实际 ${names.length}`)
if (!names.includes('scaffold_install')) throw new Error('scaffold_install 未注册')
if (!names.includes('scaffold_capture')) throw new Error('scaffold_capture 未注册')
if (!names.includes('scaffold_probe_mcp')) throw new Error('scaffold_probe_mcp 未注册')

const catalog = await ctx.skills.list()
const skill = catalog.find((s) => s.name === 'make-dsh-plugin')
console.log('技能:', skill?.name, '| modelInvocable =', skill?.invocation.modelInvocable)
if (!skill) throw new Error('make-dsh-plugin 技能未注册')

// 真实会话路径：skills.get() 会做 validateDefinition（上次线上报错的环节）
const definition = await ctx.skills.get('make-dsh-plugin')
console.log('技能加载: source =', definition.source, '| provider =', definition.provider, '| 正文', definition.content.length, '字节')
if (typeof definition.content !== 'string' || definition.content.length < 100) throw new Error('技能正文异常')

// 从注册表取出定义直接执行一次 plan（注册期 schema 校验已随 register 完成）
const def = ctx.tools.get('scaffold_plan')
const result = await def.execute({
  requirement: '做一个把 Excel 批量转 Markdown 的插件',
  plan: { pluginId: 'excel-to-md', template: 'file', dependencies: ['exceljs'] },
}, { signal: AbortSignal.timeout(30_000) })
console.log('plan 执行: pluginId =', result.pluginId, '| package =', result.packageName)
if (result.pluginId !== 'excel-to-md') throw new Error('plan 执行结果异常')

await ctx.fiber.dispose()
console.log('MOUNT TEST OK')
