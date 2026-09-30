// scaffold_* 工具共用小函数。

/** 渲染一段文本结果给模型。 */
export function textBlock(text) {
  return [{ type: 'text', text }]
}

/** 规范化插件 id：kebab-case 小写字母数字。 */
export function toKebabCase(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** 规范化工具名：snake_case。 */
export function toSnakeCase(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
}

export function isValidKebab(id) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)
}

/** 把任意值安全序列化成可读文本。 */
export function pretty(value) {
  return JSON.stringify(value, null, 2)
}
