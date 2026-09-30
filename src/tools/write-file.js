// scaffold_write_file：在插件目录内写/覆盖单个文件（路径防逃逸）。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { textBlock } from './util.js'

/** 把 rel 解析到 root 内，越界返回 null。 */
export function resolveInside(root, rel) {
  const abs = resolve(root, rel)
  return abs === root || abs.startsWith(resolve(root) + sep) ? abs : null
}

export function registerWriteFileTool(ctx) {
  ctx.tools.register(defineTool({
    name: 'scaffold_write_file',
    description: '在插件目录内写入单个文件。路径必须在 pluginDir 之内；已存在的文件需显式 overwrite=true 才覆盖。',
    parameters: {
      pluginDir: {
        type: 'string',
        required: true,
        description: '插件根目录（scaffold_create 返回的 pluginDir）',
      },
      path: {
        type: 'string',
        required: true,
        description: '相对插件根目录的文件路径，如 src/index.js',
      },
      content: {
        type: 'string',
        required: true,
        description: '完整的文件内容（UTF-8）',
      },
      overwrite: {
        type: 'boolean',
        description: '允许覆盖已存在的文件，默认 false',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          overwritten: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => textBlock(
        `${value.overwritten ? '已覆盖' : '已写入'} ${value.path}（${value.bytes} 字节）`,
      ),
    },
    execute: async (args) => {
      const abs = resolveInside(String(args.pluginDir), String(args.path))
      if (!abs) throw new Error(`路径越界：${args.path} 必须位于 ${args.pluginDir} 之内`)
      const existed = existsSync(abs)
      if (existed && args.overwrite !== true) {
        throw new Error(`文件已存在：${args.path}。确认要覆盖时传 overwrite=true`)
      }
      mkdirSync(dirname(abs), { recursive: true })
      const content = String(args.content)
      writeFileSync(abs, content, 'utf8')
      return { path: String(args.path), bytes: Buffer.byteLength(content, 'utf8'), overwritten: existed }
    },
  }))
}
