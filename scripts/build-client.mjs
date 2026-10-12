/**
 * 把「可读的 src/client」同步说明写进 lib/client.js。
 *
 * 仓库外的正式做法是复刻 harness 的 clientBundle（tsdown + lazy-CJS banner）。
 * 本示例为降低依赖，维护一份手写/生成的 lib/client.js；改 UI 时请同时改：
 *   - src/client/*（注释与类型）
 *   - lib/client.js（Web 实际加载）
 * 或把本脚本换成 esbuild/tsdown，输出仍须包在：
 *   window.__ModuleLoader__.load({ id: 'dsh-plugin', factory(require) { ... } })
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'lib', 'client.js')

if (!existsSync(out)) {
  console.error('[build-client] missing lib/client.js — restore it from git or recreate the lazy-CJS factory')
  process.exit(1)
}

mkdirSync(dirname(out), { recursive: true })
// 占位：已存在则校验可复制到自身，保证脚本可被 CI/文档引用。
copyFileSync(out, out)
console.log('[build-client] lib/client.js ready (lazy-CJS factory for dsh-plugin)')
console.log('[build-client] Edit src/client/ for the typed sketch; keep lib/client.js in sync for runtime.')
