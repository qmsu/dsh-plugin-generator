// scaffold_read_reference：读取用户上传/指定的参考文件，抽成文本喂给生成计划。
// 文本格式直读；xlsx/xls 用 exceljs 抽工作表结构；docx 用 mammoth 抽正文；图片交给模型内置 read_image。
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { textBlock } from './util.js'

const TEXT_EXT = new Set(['txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'yaml', 'yml', 'xml', 'log', 'js', 'ts', 'html', 'toml', 'ini', 'sh'])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])

async function extractExcel(buf) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const sheets = []
  for (const ws of wb.worksheets) {
    const rows = []
    ws.eachRow((row, n) => {
      if (n > 30) return // 每个工作表最多 30 行样例
      rows.push(row.values.slice(1).map((c) => (c?.text ?? c?.result ?? c ?? '').toString()).join(' | '))
    })
    sheets.push(`工作表「${ws.name}」（${ws.rowCount} 行 × ${ws.columnCount} 列）:\n${rows.join('\n')}`)
  }
  return sheets.join('\n\n')
}

async function extractDocx(buf) {
  const mammoth = await import('mammoth')
  const { value } = await mammoth.extractRawText({ buffer: buf })
  return value
}

export function registerReadReferenceTool(ctx, config) {
  ctx.tools.register(defineTool({
    name: 'scaffold_read_reference',
    description: '读取参考文件（需求文档/示例数据）作为插件生成上下文。文本直读，Excel 抽表结构，Word 抽正文；图片请用内置 read_image。',
    parameters: {
      filePath: {
        type: 'string',
        required: true,
        description: '参考文件路径（用户上传的文件路径或磁盘路径）',
      },
      maxBytes: {
        type: 'integer',
        description: `读取字节上限，默认 ${config.maxFileBytes}`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          fileName: { type: 'string', required: true },
          kind: { type: 'string', required: true },
          text: { type: 'string', required: true },
          truncated: { type: 'boolean', required: true },
          sizeBytes: { type: 'integer', required: true },
        },
      },
      render: (args, value) => textBlock(
        `${value.fileName}（${value.kind}${value.truncated ? '，已截断' : ''}，${value.sizeBytes} 字节）\n\n${value.text}`,
      ),
    },
    execute: async (args, exec) => {
      const filePath = String(args.filePath)
      const maxBytes = Number(args.maxBytes ?? config.maxFileBytes)
      const st = await stat(filePath)
      const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
      const buf = await readFile(filePath)

      if (IMAGE_EXT.has(ext)) {
        throw new Error(`${basename(filePath)} 是图片，请不要用本工具：直接用你内置的 read_image 工具查看它`)
      }
      if (ext === 'pdf') {
        throw new Error('PDF 暂不支持直接抽取（v0.2 计划支持 pdfjs-dist）。可请用户转成 docx/txt，或让用户简述 PDF 内容')
      }

      let text
      let kind
      if (ext === 'xlsx' || ext === 'xls') {
        kind = 'excel'
        text = await extractExcel(buf)
      } else if (ext === 'docx') {
        kind = 'docx'
        text = await extractDocx(buf)
      } else if (TEXT_EXT.has(ext) || !ext) {
        kind = 'text'
        text = buf.toString('utf8')
      } else {
        kind = 'binary'
        throw new Error(`不支持的参考文件类型: .${ext}（支持文本类 / xlsx / xls / docx）`)
      }

      const truncated = Buffer.byteLength(text, 'utf8') > maxBytes
      if (truncated) {
        text = Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8') + '\n…[已截断]'
      }
      exec.signal?.throwIfAborted()
      return { fileName: basename(filePath), kind, text, truncated, sizeBytes: st.size }
    },
  }))
}
