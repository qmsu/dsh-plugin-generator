// 安装验收回归：生成流程的“装上”必须等于 applied + 目标条目 active + 无目标 pending 警告。
// 只用 mock plugin_manager，验证 installPluginWithAcceptance 的判定逻辑，不碰真实 dsh 运行时。
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { installPluginWithAcceptance } from '../src/install-acceptance.js'

const root = mkdtempSync(join(tmpdir(), 'dsh-install-acceptance-'))

function makePlugin(name, { entry = 'export const inject = []\nexport function apply() {}\n', patch = true } = {}) {
  const dir = join(root, name)
  mkdirSync(join(dir, 'src'), { recursive: true })
  const pkg = {
    name,
    version: '0.1.0',
    type: 'module',
    main: 'src/index.js',
  }
  if (patch) {
    pkg.dsh = { bundle: { patch: ['cordis.patch.yml'] } }
    writeFileSync(join(dir, 'cordis.patch.yml'), `entries:\n  - id: ${name}-entry\n`)
  }
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
  writeFileSync(join(dir, 'src', 'index.js'), entry)
  return dir
}

function fakeCtx(pm) {
  return { get: (key) => (key === 'pluginManager' ? pm : undefined) }
}

function fakePm({ installResult, entries = [], calls = {} }) {
  return {
    calls,
    async installBundle(dir) {
      calls.installBundle = (calls.installBundle ?? 0) + 1
      calls.dir = dir
      return installResult
    },
    async listPlugins() {
      return entries
    },
  }
}

const results = []
async function test(name, fn) {
  try {
    await fn()
    results.push(['ok', name])
  } catch (e) {
    results.push(['fail', `${name}: ${e.message}`])
  }
}

// 1. 预检失败（inject logger）时不应调用 installBundle
await test('预检失败不调用 installBundle', async () => {
  const dir = makePlugin('bad-inject', { entry: 'export const inject = [\'logger\']\nexport function apply() {}\n' })
  const pm = fakePm({ installResult: { application: 'applied' } })
  const res = await installPluginWithAcceptance(fakeCtx(pm), dir)
  assert.equal(res.ok, false)
  assert.equal(res.application, 'failed')
  assert.match(res.diagnostic, /预检/)
  assert.equal(pm.calls.installBundle ?? 0, 0)
})

// 2. applied + active + 无警告 → 验收通过
await test('applied 且 active 时验收通过', async () => {
  const dir = makePlugin('good-plugin')
  const pm = fakePm({
    installResult: { application: 'applied', warnings: [] },
    entries: [{ moduleName: 'good-plugin', fiberPhase: 'active' }],
  })
  const res = await installPluginWithAcceptance(fakeCtx(pm), dir)
  assert.equal(res.ok, true)
  assert.equal(res.active, true)
  assert.equal(res.fiberPhase, 'active')
  assert.equal(res.restartRequired, false)
})

// 3. applied 但条目 pending → 验收失败
await test('applied 但 fiberPhase=pending 时验收失败', async () => {
  const dir = makePlugin('pending-plugin')
  const pm = fakePm({
    installResult: { application: 'applied', warnings: [] },
    entries: [{ moduleName: 'pending-plugin', fiberPhase: 'pending' }],
  })
  const res = await installPluginWithAcceptance(fakeCtx(pm), dir)
  assert.equal(res.ok, false)
  assert.equal(res.active, false)
  assert.match(res.diagnostic, /未激活|pending/)
})

// 4. 目标插件相关的 did not activate 警告 → 验收失败
await test('目标 pending 警告导致验收失败', async () => {
  const dir = makePlugin('warn-plugin')
  const pm = fakePm({
    installResult: {
      application: 'applied',
      warnings: ['dsh: warning: 1 entry did not activate warn-plugin (warn-plugin-entry): pending (waiting for service: foo)'],
    },
    entries: [{ moduleName: 'warn-plugin', fiberPhase: 'active' }],
  })
  const res = await installPluginWithAcceptance(fakeCtx(pm), dir)
  assert.equal(res.ok, false)
  assert.match(res.diagnostic, /did not activate/)
})

// 5. 无关插件的警告不影响验收
await test('无关插件警告不影响验收', async () => {
  const dir = makePlugin('quiet-plugin')
  const pm = fakePm({
    installResult: {
      application: 'applied',
      warnings: ['dsh: warning: 1 entry did not activate other-plugin (other-entry): pending'],
    },
    entries: [{ moduleName: 'quiet-plugin', fiberPhase: 'active' }],
  })
  const res = await installPluginWithAcceptance(fakeCtx(pm), dir)
  assert.equal(res.ok, true)
})

// 6. restart-required 不算验收通过
await test('restart-required 不算验收通过', async () => {
  const dir = makePlugin('restart-plugin')
  const pm = fakePm({
    installResult: { application: 'restart-required', restartReason: 'config-changed', warnings: [] },
    entries: [{ moduleName: 'restart-plugin', fiberPhase: 'active' }],
  })
  const res = await installPluginWithAcceptance(fakeCtx(pm), dir)
  assert.equal(res.ok, false)
  assert.equal(res.restartRequired, true)
  assert.match(res.diagnostic, /重启/)
})

// 7. 运行时插件表中找不到目标条目 → 验收失败
await test('插件表缺目标条目时验收失败', async () => {
  const dir = makePlugin('missing-plugin')
  const pm = fakePm({
    installResult: { application: 'applied', warnings: [] },
    entries: [],
  })
  const res = await installPluginWithAcceptance(fakeCtx(pm), dir)
  assert.equal(res.ok, false)
  assert.match(res.diagnostic, /未找到目标条目/)
})

rmSync(root, { recursive: true, force: true })

let failed = 0
for (const [status, name] of results) {
  console.log(`${status === 'ok' ? '✓' : '✗'} ${name}`)
  if (status !== 'ok') failed++
}
if (failed) {
  console.error(`\n${failed} 个用例失败`)
  process.exit(1)
}
console.log('\n安装验收测试全部通过')
