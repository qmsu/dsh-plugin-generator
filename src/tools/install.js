// scaffold_install：把生成的插件装进当前 profile（pluginManager.installBundle，live 生效）。
// 与页面「安装」共用 ensurePluginDeps——本地目录 link 进 profile 时依赖需要自己装。
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ensurePluginDeps, readPluginPackage } from '../activation.js'
import { textBlock } from './util.js'

export function registerInstallTool(ctx) {
  ctx.tools.register(defineTool({
    name: 'scaffold_install',
    description: '把已生成的插件装进当前 profile 并激活（用户明确要求安装时再调用）。会先在插件目录内安装它的 dependencies（pnpm/npm），再走 dsh 的 plugin_manager 完成装包与激活。',
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
          restartRequired: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => textBlock(
        value.ok
          ? `已安装并激活插件「${value.pluginName}」${value.restartRequired ? '（需重启 profile 生效）' : '（live 生效）'}`
          : `安装失败：${value.diagnostic ?? '未知错误'}`,
      ),
    },
    execute: async (args) => {
      const pluginDir = resolve(String(args.pluginDir ?? '').trim())
      if (!pluginDir || !existsSync(join(pluginDir, 'package.json'))) {
        throw new Error(`插件目录无效: ${pluginDir}`)
      }
      const pkg = readPluginPackage(pluginDir)
      if (!pkg?.name) throw new Error('package.json 缺 name')

      const pm = ctx.get('pluginManager')
      if (!pm) throw new Error('当前环境没有 plugin_manager 服务，无法自动安装（请用 dsh plugin add 手动安装）')

      ensurePluginDeps(pluginDir)
      const result = await pm.installBundle(pluginDir)
      const ok = result.application !== 'failed' && result.application !== 'cancelled'
      return {
        ok,
        application: result.application,
        pluginName: pkg.name,
        diagnostic: result.error?.diagnostic ?? result.error?.code,
        restartRequired: result.application === 'restart-required',
      }
    },
  }))
}