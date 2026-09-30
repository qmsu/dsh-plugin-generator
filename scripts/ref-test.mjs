// 验证 scaffold_read_reference 的 Excel/docx 抽取。
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerScaffoldTools } from '../src/tools/index.js'

const dir = '/Users/zg/Documents/fnsync/息壤/xirang-code/dsh-plugin-generator/.e2e-ref'
const registered = new Map()
registerScaffoldTools({
  logger: { info: () => {} },
  tools: { register(def) { registered.set(def.name, def); return () => {} } },
}, { outputDir: dir, maxFileBytes: 100_000, zipMaxBytes: 20e6, allowedDependencies: [] })

// 造一个 xlsx
const ExcelJS = (await import('exceljs')).default
const wb = new ExcelJS.Workbook()
const ws = wb.addWorksheet('测试表')
ws.addRow(['姓名', '年龄', '城市'])
ws.addRow(['张三', 30, '北京'])
ws.addRow(['李四', 25, '上海'])
const xlsxPath = join(dir, 'sample.xlsx')
writeFileSync(xlsxPath, await wb.xlsx.writeBuffer())

const exec = { signal: AbortSignal.timeout(30_000) }
const res = await registered.get('scaffold_read_reference').execute({ filePath: xlsxPath }, exec)
console.log('kind:', res.kind, 'truncated:', res.truncated)
console.log(res.text)
if (!res.text.includes('姓名') || !res.text.includes('张三')) throw new Error('xlsx 抽取内容不对')
console.log('READ_REFERENCE OK')
