// 依赖安装回归：dsh 由桌面/GUI 启动时，PATH 常不含 pnpm/npm/node。
// ensurePluginDeps 必须复用当前 JS 运行时自带的 npm CLI，而不是依赖宿主 PATH。
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensurePluginDeps } from '../src/activation.js'

const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-scaffold-deps-'))
const fixtureDir = join(root, 'fixture')
const pluginDir = join(root, 'plugin')

mkdirSync(fixtureDir, { recursive: true })
writeFileSync(join(fixtureDir, 'package.json'), `${JSON.stringify({
  name: 'fixture-dep',
  version: '1.0.0',
  type: 'module',
  main: 'index.js',
}, null, 2)}\n`)
writeFileSync(join(fixtureDir, 'index.js'), 'export const ok = true\n')

mkdirSync(pluginDir, { recursive: true })
writeFileSync(join(pluginDir, 'package.json'), `${JSON.stringify({
  name: 'fixture-plugin',
  version: '1.0.0',
  type: 'module',
  main: 'index.js',
  dependencies: { 'fixture-dep': 'file:../fixture' },
}, null, 2)}\n`)
writeFileSync(join(pluginDir, 'index.js'), 'export const ok = true\n')

const oldPath = process.env.PATH
const oldNpmExecPath = process.env.npm_execpath
const oldNpmNodeExecPath = process.env.npm_node_execpath
const oldNode = process.env.NODE
process.env.PATH = '/usr/bin:/bin'
delete process.env.npm_execpath
delete process.env.npm_node_execpath
delete process.env.NODE

try {
  ensurePluginDeps(pluginDir)
  if (!existsSync(join(pluginDir, 'node_modules', 'fixture-dep', 'package.json'))) {
    throw new Error('依赖没有安装到插件 node_modules')
  }
  console.log('ACTIVATION DEPS TEST OK')
} finally {
  process.env.PATH = oldPath
  if (oldNpmExecPath !== undefined) process.env.npm_execpath = oldNpmExecPath
  if (oldNpmNodeExecPath !== undefined) process.env.npm_node_execpath = oldNpmNodeExecPath
  if (oldNode !== undefined) process.env.NODE = oldNode
  rmSync(root, { recursive: true, force: true })
}
