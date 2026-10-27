// 依赖安装回归：dsh 由桌面/GUI 启动时，PATH 常不含 pnpm/npm/node。
// ensurePluginDeps 必须优先复用 dsh Desktop primary-runtime，再不依赖 PATH 地使用 Node 自带 npm。
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { activationDryRun, ensurePluginDeps } from '../src/activation.js'

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

  // dsh Desktop（Windows）宿主：不是标准 Node 安装；primary-runtime 提供 node + pnpm.mjs。
  const desktopRuntime = join(root, 'primary-runtime')
  const desktopNode = join(desktopRuntime, 'dependencies', 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node')
  const desktopPnpm = join(desktopRuntime, 'dependencies', 'pnpm', 'bin', 'pnpm.mjs')
  mkdirSync(dirname(desktopNode), { recursive: true })
  mkdirSync(dirname(desktopPnpm), { recursive: true })
  symlinkSync(process.execPath, desktopNode)
  writeFileSync(desktopPnpm, `import { mkdirSync, writeFileSync } from 'node:fs'\nimport { join } from 'node:path'\nmkdirSync(join(process.cwd(), 'node_modules', 'fixture-dep'), { recursive: true })\nwriteFileSync(join(process.cwd(), 'node_modules', 'fixture-dep', 'desktop-pnpm-used'), 'yes\\n')\n`)

  const desktopPlugin = join(root, 'desktop-plugin')
  mkdirSync(desktopPlugin, { recursive: true })
  writeFileSync(join(desktopPlugin, 'package.json'), `${JSON.stringify({
    name: 'desktop-fixture-plugin',
    version: '1.0.0',
    type: 'module',
    main: 'index.js',
    dependencies: { 'fixture-dep': 'file:../fixture' },
  }, null, 2)}\n`)
  writeFileSync(join(desktopPlugin, 'index.js'), 'export const ok = true\n')

  const oldArgv = process.argv.slice()
  process.argv.length = 2
  process.argv[4] = desktopRuntime
  try {
    ensurePluginDeps(desktopPlugin)
  } finally {
    process.argv.length = 0
    process.argv.push(...oldArgv)
  }
  if (!existsSync(join(desktopPlugin, 'node_modules', 'fixture-dep', 'desktop-pnpm-used'))) {
    throw new Error('dsh Desktop primary-runtime 的 pnpm 未被用于依赖安装')
  }

  // 桌面 Host 正常还会通过 profileContext.packageManager 明确传入 pnpm 调用；页面/工具优先使用它。
  const explicitPlugin = join(root, 'explicit-plugin')
  mkdirSync(explicitPlugin, { recursive: true })
  writeFileSync(join(explicitPlugin, 'package.json'), `${JSON.stringify({
    name: 'explicit-fixture-plugin',
    version: '1.0.0',
    type: 'module',
    main: 'index.js',
    dependencies: { 'fixture-dep': 'file:../fixture' },
  }, null, 2)}\n`)
  writeFileSync(join(explicitPlugin, 'index.js'), 'export const ok = true\n')
  ensurePluginDeps(explicitPlugin, {
    command: desktopNode,
    args: [desktopPnpm],
    env: {},
  })
  if (!existsSync(join(explicitPlugin, 'node_modules', 'fixture-dep', 'desktop-pnpm-used'))) {
    throw new Error('profileContext.packageManager 未被用于依赖安装')
  }

  // Cordis 的 logger 是内置属性，不是可注入服务；声明 inject: ['logger'] 会在 dsh 里一直 pending。
  const badInjectPlugin = join(root, 'bad-inject-plugin')
  mkdirSync(badInjectPlugin, { recursive: true })
  writeFileSync(join(badInjectPlugin, 'package.json'), `${JSON.stringify({
    name: 'bad-inject-plugin',
    version: '1.0.0',
    type: 'module',
    main: 'index.js',
  }, null, 2)}\n`)
  writeFileSync(join(badInjectPlugin, 'index.js'), `export const name = 'bad-inject-plugin'\nexport const inject = ['logger']\nexport function apply(ctx) { ctx.logger.info('x') }\n`)
  const badInject = await activationDryRun(badInjectPlugin)
  if (badInject.ok || !/logger/.test(badInject.error ?? '') || !/inject/.test(badInject.error ?? '')) {
    throw new Error(`inject logger 未被发现: ${JSON.stringify(badInject)}`)
  }

  console.log('ACTIVATION DEPS TEST OK')
} finally {
  process.env.PATH = oldPath
  if (oldNpmExecPath !== undefined) process.env.npm_execpath = oldNpmExecPath
  if (oldNpmNodeExecPath !== undefined) process.env.npm_node_execpath = oldNpmNodeExecPath
  if (oldNode !== undefined) process.env.NODE = oldNode
  rmSync(root, { recursive: true, force: true })
}
