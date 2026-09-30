// scaffold_validate：结构 + 语法校验。有错返回结构化错误清单，模型据此修复。
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { activationDryRun } from '../activation.js'
import { pretty, textBlock } from './util.js'

const execFileP = promisify(execFile)

/** 递归收集插件目录内的 .js 文件（跳过 node_modules）。 */
function collectJsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const abs = join(dir, name)
    const st = statSync(abs)
    if (st.isDirectory()) collectJsFiles(abs, out)
    else if (name.endsWith('.js')) out.push(abs)
  }
  return out
}

export function registerValidateTool(ctx) {
  ctx.tools.register(defineTool({
    name: 'scaffold_validate',
    description: '校验插件工程：package.json 字段、bundle 声明、cordis.patch.yml、入口存在性、JS 语法、schema DSL 静态规则，并做一次真实激活预检（装依赖 → import → apply，暴露 defineTool 的 schema 编译错误）。生成/修改后必须校验。',
    parameters: {
      pluginDir: {
        type: 'string',
        required: true,
        description: '插件根目录',
      },
      deep: {
        type: 'boolean',
        description: '是否做激活预检（默认 true；装依赖需要网络，可置 false 只做静态检查）',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          errors: { type: 'json', required: true },
          warnings: { type: 'json', required: true },
          checkedFiles: { type: 'json', required: true },
        },
      },
      render: (args, value) => textBlock(
        (value.ok ? '✓ 校验通过' : `✗ 校验失败（${value.errors.length} 个错误）`) + '\n' +
        (value.errors.length ? `错误：\n${value.errors.map((e) => `- ${e}`).join('\n')}\n` : '') +
        (value.warnings.length ? `警告：\n${value.warnings.map((w) => `- ${w}`).join('\n')}\n` : '') +
        `\n已检查 ${value.checkedFiles.length} 个 JS 文件`,
      ),
    },
    execute: async (args, exec) => {
      const pluginDir = resolve(String(args.pluginDir))
      const errors = []
      const warnings = []
      const checkedFiles = []

      if (!existsSync(pluginDir)) throw new Error(`目录不存在: ${pluginDir}`)

      // package.json
      const pkgPath = join(pluginDir, 'package.json')
      let pkg = null
      if (!existsSync(pkgPath)) {
        errors.push('缺少 package.json')
      } else {
        try {
          pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
          if (!pkg.name) errors.push('package.json 缺 name')
          if (!pkg.version) errors.push('package.json 缺 version')
          if (pkg.type !== 'module') warnings.push('package.json 建议 "type": "module"（纯 ESM 免构建）')
          if (!pkg.dsh?.bundle?.patch) errors.push('package.json 缺 dsh.bundle.patch 声明（不是可安装的 bundle）')
          if (!pkg.exports?.['./cordis.patch.yml']) warnings.push('exports 未暴露 ./cordis.patch.yml')
        } catch (e) {
          errors.push(`package.json 解析失败: ${e.message}`)
        }
      }

      // cordis.patch.yml
      const patchPath = join(pluginDir, 'cordis.patch.yml')
      if (!existsSync(patchPath)) {
        errors.push('缺少 cordis.patch.yml')
      } else {
        const yml = readFileSync(patchPath, 'utf8')
        if (!/^-\s*insert:/m.test(yml)) errors.push('cordis.patch.yml 未包含 - insert: 条目')
        if (pkg?.name && !yml.includes(pkg.name)) warnings.push('cordis.patch.yml 未引用包名，确认条目 name 与 package.json 一致')
      }

      // 入口
      const main = pkg?.main ?? 'src/index.js'
      if (!existsSync(join(pluginDir, main))) {
        errors.push(`入口文件不存在: ${main}`)
      }

      // JS 语法 + 已知踩坑静态规则（dsh-tools schema DSL 的真实限制）
      for (const file of collectJsFiles(pluginDir)) {
        checkedFiles.push(file.slice(pluginDir.length + 1))
        try {
          await execFileP(process.execPath, ['--check', file], { signal: exec.signal })
        } catch (e) {
          errors.push(`语法错误 ${file.slice(pluginDir.length + 1)}: ${String(e.stderr ?? e.message).split('\n')[0]}`)
          continue
        }
        const src = readFileSync(file, 'utf8')
        const rel = file.slice(pluginDir.length + 1)
        if (/type\s*:\s*\[/.test(src)) {
          errors.push(`${rel}: schema 的 type 不能是联合数组（如 type: ['string','array']）——dsh DSL 只接受单类型，联合语义改单类型 + 执行内归一化`)
        }
        if (/type\s*:\s*'array'[^}]*?additionalProperties/s.test(src) || /additionalProperties[^}]*?type\s*:\s*'array'/s.test(src)) {
          warnings.push(`${rel}: array 上写 additionalProperties 不被支持，请移除（object 上才需要显式声明）`)
        }
      }

      // 激活预检：装依赖 → import → apply（defineTool 编译 schema 的真实失败点）
      let activation = null
      if (args.deep !== false && !errors.some((e) => e.startsWith('入口') || e.startsWith('缺少'))) {
        activation = await activationDryRun(pluginDir)
        if (!activation.ok) errors.push(`激活预检失败: ${activation.error}`)
      }

      return { ok: errors.length === 0, errors, warnings, checkedFiles }
    },
  }))
}
