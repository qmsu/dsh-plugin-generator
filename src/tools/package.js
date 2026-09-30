// scaffold_package：把插件目录打成 zip 并给出安装命令。
import { execFile } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { textBlock } from './util.js'

const execFileP = promisify(execFile)

export function registerPackageTool(ctx, config) {
  ctx.tools.register(defineTool({
    name: 'scaffold_package',
    description: '把校验通过的插件目录打成 zip 产物，并输出安装命令。打包前会做结构检查，不通过则报错。',
    parameters: {
      pluginDir: {
        type: 'string',
        required: true,
        description: '插件根目录',
      },
      outPath: {
        type: 'string',
        description: 'zip 输出路径，默认 <pluginDir 同级>/<插件名>.zip',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          zipPath: { type: 'string', required: true },
          sizeBytes: { type: 'integer', required: true },
          installCommands: { type: 'json', required: true },
        },
      },
      render: (args, value) => textBlock(
        `打包完成：${value.zipPath}（${(value.sizeBytes / 1024).toFixed(1)} KB）\n\n安装：\n${value.installCommands.map((c) => `- ${c}`).join('\n')}`,
      ),
    },
    execute: async (args, exec) => {
      const pluginDir = resolve(String(args.pluginDir))
      if (!existsSync(pluginDir)) throw new Error(`目录不存在: ${pluginDir}`)
      if (!existsSync(join(pluginDir, 'package.json'))) {
        throw new Error('缺少 package.json，不是合法插件目录（先跑 scaffold_validate）')
      }

      const name = basename(pluginDir)
      const zipPath = resolve(String(args.outPath ?? join(pluginDir, '..', `${name}.zip`)))
      if (existsSync(zipPath)) {
        throw new Error(`产物已存在: ${zipPath}（先删除或换 outPath）`)
      }

      // 依赖系统 zip（macOS/Linux 自带；Windows 需装 Git Bash 的 zip）
      await execFileP('zip', ['-qr', zipPath, '.', '-x', 'node_modules/*'], {
        cwd: pluginDir,
        signal: exec.signal,
      }).catch((e) => {
        throw new Error(`zip 打包失败：${e.message}。若无 zip 命令，可让用户直接安装目录：dsh plugin --profile <profile> add ${pluginDir}`)
      })

      const sizeBytes = statSync(zipPath).size
      if (sizeBytes > config.zipMaxBytes) {
        throw new Error(`产物 ${(sizeBytes / 1048576).toFixed(1)}MB 超过上限 ${(config.zipMaxBytes / 1048576).toFixed(0)}MB（检查是否误打进大文件）`)
      }

      return {
        zipPath,
        sizeBytes,
        installCommands: [
          `dsh plugin --profile <profile> add ${pluginDir}`,
          `dsh plugin --profile <profile> add ${zipPath}`,
        ],
      }
    },
  }))
}
