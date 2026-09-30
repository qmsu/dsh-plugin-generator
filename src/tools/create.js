// scaffold_create：按模板把插件工程骨架落到磁盘。
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { TEMPLATES } from '../templates/index.js'
import { getOutputDir } from '../settings.js'
import { pretty, textBlock } from './util.js'

export function registerCreateTool(ctx, config) {
  ctx.tools.register(defineTool({
    name: 'scaffold_create',
    description: '按插件计划生成工程骨架（package.json / cordis.patch.yml / src/index.js）。计划需先经用户确认。',
    parameters: {
      plan: {
        type: 'json',
        required: true,
        description: 'scaffold_plan 返回的计划对象（含 pluginId / packageName / template / tools 等）',
      },
      outputDir: {
        type: 'string',
        description: `输出根目录，默认用户设置或 ${config.outputDir}`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pluginDir: { type: 'string', required: true },
          files: { type: 'json', required: true },
          nextSteps: { type: 'string', required: true },
        },
      },
      render: (args, value) => textBlock(
        `已生成插件骨架：${value.pluginDir}\n文件：\n${value.files.map((f) => `- ${f}`).join('\n')}\n\n下一步：\n${value.nextSteps}`,
      ),
    },
    execute: async (args) => {
      const plan = args.plan
      if (!plan || typeof plan !== 'object' || !plan.pluginId || !plan.template) {
        throw new Error('plan 参数无效：需要 scaffold_plan 返回的完整计划对象')
      }
      const render = TEMPLATES[plan.template]
      if (!render) throw new Error(`未知模板: ${plan.template}（可选：${Object.keys(TEMPLATES).join(' / ')}）`)

      const root = resolve(String(args.outputDir ?? getOutputDir(config.outputDir)))
      const pluginDir = join(root, plan.pluginId)
      if (existsSync(pluginDir)) {
        throw new Error(`目录已存在: ${pluginDir}（换个插件名，或先用 scaffold_validate 检查后手动清理）`)
      }

      const files = render(plan)
      const written = []
      for (const [rel, content] of Object.entries(files)) {
        const abs = join(pluginDir, rel)
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, content, 'utf8')
        written.push(rel)
      }

      return {
        pluginDir,
        files: written,
        nextSteps: [
          '1) 用 scaffold_write_file 完善 src/index.js 的业务逻辑（TODO 处）',
          '2) 用 scaffold_validate 校验，有错就改到通过',
          '3) 用 scaffold_package 打包，输出安装命令给用户',
        ].join('\n'),
      }
    },
  }))
}
