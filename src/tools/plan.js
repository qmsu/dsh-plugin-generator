// scaffold_plan：把模型的计划草案规范化并校验，产出最终计划。
// 价值：插件名/模板/依赖这些"规矩"由工具兜底，模型只负责想清楚做什么。
import { defineTool } from '@deepseek-ai/dsh-tools'
import { isValidKebab, pretty, textBlock, toKebabCase, toSnakeCase } from './util.js'

const TEMPLATES = ['tool', 'events', 'file', 'capability']

export function registerPlanTool(ctx, config) {
  ctx.tools.register(defineTool({
    name: 'scaffold_plan',
    description: '规范化并校验插件生成计划：修正插件名、选择模板、检查依赖白名单。制作插件的第 1 步。',
    parameters: {
      requirement: {
        type: 'string',
        required: true,
        description: '用户需求原文（一句话描述要做什么插件）',
      },
      plan: {
        type: 'json',
        description: '你的计划草案：{ pluginId, description, template, tools, events, dependencies }，缺省时按需求推断一个最小计划',
      },
      referenceSummary: {
        type: 'string',
        description: '参考文件的内容摘要（由 scaffold_read_reference 的结果整理而来），没有则省略',
      },
      approvedDependencies: {
        type: 'json',
        description: '用户明确同意使用的白名单外依赖（如 ["xlsx"]）。仅限用户在本会话中明确批准后传入',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pluginId: { type: 'string', required: true },
          packageName: { type: 'string', required: true },
          description: { type: 'string', required: true },
          template: { type: 'string', required: true },
          tools: { type: 'json', required: true },
          events: { type: 'json', required: true },
          dependencies: { type: 'json', required: true },
          warnings: { type: 'json', required: true },
        },
      },
      render: (args, value) => textBlock(
        `插件计划（${value.packageName}，模板 ${value.template}）\n` +
        (value.warnings.length
          ? `警告：\n${value.warnings.map((w) => `- ${w}`).join('\n')}\n`
          : '') +
        `\n${pretty({ ...value, warnings: undefined })}`,
      ),
    },
    execute: async (args) => {
      const warnings = []
      const draft = args.plan && typeof args.plan === 'object' ? args.plan : {}

      // 插件 id：草案给出就规范化，否则从需求抓前几个实词，再退化到随机名
      let pluginId = toKebabCase(draft.pluginId ?? draft.name ?? '')
      if (!pluginId) {
        pluginId = toKebabCase(String(args.requirement).split(/[，,。.!！?？\s]+/)[0]) || 'my-plugin'
        warnings.push(`未给出插件名，已从需求推断为 "${pluginId}"，请确认`)
      }
      if (!isValidKebab(pluginId)) {
        throw new Error(`插件 id 非法（需 kebab-case 小写字母数字）: ${pluginId}`)
      }

      // 模板
      let template = String(draft.template ?? 'tool')
      if (!TEMPLATES.includes(template)) {
        warnings.push(`模板 "${template}" 不存在，已回退为 "tool"（可选：${TEMPLATES.join(' / ')}）`)
        template = 'tool'
      }
      if (template === 'file' && !String(args.requirement + JSON.stringify(draft)).match(/file|文件|excel|pdf|csv|word|docx|xlsx/i)) {
        warnings.push('选择了 file 模板，但需求未明显涉及文件处理，确认是否真需要')
      }

      // 工具清单
      const tools = Array.isArray(draft.tools) ? draft.tools.map((t) => ({
        name: toSnakeCase(t.name ?? '') || 'my_tool',
        description: String(t.description ?? ''),
        params: Array.isArray(t.params) ? t.params : [],
        returns: String(t.returns ?? ''),
      })) : []
      if (template !== 'events' && template !== 'capability' && tools.length === 0) {
        tools.push({
          name: pluginId.replace(/-/g, '_'),
          description: String(draft.description ?? args.requirement).slice(0, 80),
          params: [],
          returns: '处理结果文本',
        })
        warnings.push('计划草案未给出工具清单，已补一个默认工具，请完善其参数')
      }
      for (const t of tools) {
        if (!t.description) warnings.push(`工具 "${t.name}" 缺描述，模型将难以路由到它`)
      }

      // 事件
      const events = Array.isArray(draft.events) ? draft.events.map(String) : []
      if (template === 'events' && events.length === 0) {
        warnings.push('events 模板但未声明监听事件，骨架将只给 turn/end 示例')
      }

      // 依赖白名单；用户明确批准的依赖（approvedDependencies）可放行
      const allowed = new Set(config.allowedDependencies)
      const approved = new Set(Array.isArray(args.approvedDependencies) ? args.approvedDependencies.map(String) : [])
      const dependencies = Array.isArray(draft.dependencies) ? draft.dependencies.map(String) : []
      const rejected = dependencies.filter((d) => !allowed.has(d) && !approved.has(d))
      if (rejected.length) {
        warnings.push(`依赖 ${rejected.join(', ')} 不在白名单（${[...allowed].join(', ')}），已从计划移除；如确需要，向用户说明用途并取得同意后重试，将其同时放入 dependencies 与 approvedDependencies`)
      }
      const deps = dependencies.filter((d) => allowed.has(d) || approved.has(d))
      if (template === 'file') {
        for (const lib of ['exceljs', 'mammoth']) {
          if (!deps.includes(lib) && /excel|xlsx|csv/i.test(JSON.stringify(draft) + args.requirement) && lib === 'exceljs') deps.push('exceljs')
        }
      }

      const description = String(draft.description ?? args.requirement).slice(0, 200)
      return {
        pluginId,
        packageName: pluginId.startsWith('dsh-') ? pluginId : `dsh-${pluginId}`,
        description,
        template,
        tools,
        events,
        dependencies: deps,
        warnings,
      }
    },
  }))
}
