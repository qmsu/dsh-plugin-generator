// dsh-plugin-generator：dsh 插件制作脚手架。
// 在 dsh 会话里一句话制作插件：内嵌 skill 引导模型，scaffold_* 工具负责落地文件。
import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { registerScaffoldSkill } from './skill.js'
import { registerScaffoldTools } from './tools/index.js'
import { registerScaffoldPage } from './page.js'

export const name = 'dsh-plugin-generator'
export const inject = ['tools', 'skills']

export const Config = z.object({
  // 生成插件工程的默认输出根目录；空 = <用户主目录>/dsh-scaffold
  outputDir: z.string().default(''),
  // scaffold_read_reference 单次读取的字节上限
  maxFileBytes: z.number().default(2 * 1024 * 1024),
  // scaffold_package 产物 zip 的大小上限
  zipMaxBytes: z.number().default(20 * 1024 * 1024),
  // 生成插件允许声明的依赖白名单（装包仍需用户批准）
  allowedDependencies: z.array(z.string()).default([
    'exceljs',
    'xlsx',
    'pdfjs-dist',
    'mammoth',
    'papaparse',
    'yaml',
    'marked',
  ]),
})

export function apply(ctx, config = {}) {
  const resolved = { ...config }
  if (!resolved.outputDir) {
    resolved.outputDir = join(homedir(), 'dsh-scaffold')
  }
  registerScaffoldTools(ctx, resolved)
  registerScaffoldSkill(ctx, resolved)
  registerScaffoldPage(ctx, resolved)
  ctx.logger.info(`dsh-plugin-generator 就绪：默认输出目录 ${resolved.outputDir}`)
}
