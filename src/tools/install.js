// scaffold_install：生成流程的安装验收。真实走 plugin_manager，并要求目标条目在当前运行时 active。
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { installPluginWithAcceptance } from '../install-acceptance.js'
import { textBlock } from './util.js'

export function registerInstallTool(ctx) {
  ctx.tools.register(defineTool({
    name: 'scaffold_install',
    description: '安装验收：把已生成插件真实装进当前 profile，并确认目标条目已 active。生成流程在校验通过后必须调用；失败则按 diagnostic 修复后重新 validate/install。',
    parameters: {
      pluginDir: {
        type: 'string',
        required: true,
        description: '插件根目录（scaffold_create 返回的 pluginDir）',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          application: { type: 'string', required: true },
          pluginName: { type: 'string', required: true },
          diagnostic: { type: 'string' },
          warnings: { type: 'json' },
          active: { type: 'boolean', required: true },
          fiberPhase: { type: 'string' },
          restartRequired: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => textBlock(
        value.ok
          ? `已安装并激活插件「${value.pluginName}」${value.restartRequired ? '（需重启 profile 生效）' : '（live 生效）'}`
          : `安装验收失败：${value.diagnostic ?? '未知错误'}`,
      ),
    },
    execute: async (args) => {
      const pluginDir = resolve(String(args.pluginDir ?? '').trim())
      if (!pluginDir || !existsSync(join(pluginDir, 'package.json'))) {
        throw new Error(`插件目录无效: ${pluginDir}`)
      }
      return await installPluginWithAcceptance(ctx, pluginDir)
    },
  }))
}
