/**
 * 把浏览器半 `src/client` 打包成 `lib/client.js`（lazy-CJS factory）。
 *
 * 产物形态与 harness 的 `clientBundle` 一致：
 *
 *   var module = { exports: {} }; var exports = module.exports;
 *   window.__ModuleLoader__.load({ id: '<包名>', factory: (require) => {
 *     …CJS 产物…
 *     return module.exports; } });
 *
 * 外部依赖（react / react/jsx-runtime）**不打包**：factory 里注入的 `require`
 * 由 Web 外壳的模块表解析——不是全局变量，也不是 import map。
 * 浏览器半只用 type-only 方式引入 harness 的客户端包，因此产物里没有它们的运行时代码。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'src', 'client', 'index.ts')
const outFile = join(root, 'lib', 'client.js')

/** 插件 id：必须是包名，且与 cordis.patch.yml 里的裸包名一致。 */
const PLUGIN_ID = 'dsh-usage-cmdkit'

/**
 * 插件版本号：面板底栏要写明「这是哪一版」。
 *
 * 唯一事实来源是 package.json，构建时注入成常量——
 * 源码里不写死版本，发布时也不会忘了改。
 */
const VERSION = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version

/**
 * 走模块表解析的外部依赖。
 *
 * 与 harness 的 `PLATFORM_MODULES` 对齐：这些名字在 Web 外壳冻结的模块表里，
 * 打包时保持为外部引用，不要内联副本（内联的 React 会与外壳那一份不是同一个运行时）。
 */
const EXTERNAL = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

const result = await build({
  entryPoints: [entry],
  outfile: 'client.js',
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: true,
  sourcesContent: true,
  minify: true,
  logLevel: 'warning',
  external: EXTERNAL,
  define: {
    'process.env.NODE_ENV': '"production"',
    // 底栏的版本号：来自 package.json，源码里不写死。
    __DSH_USAGE_VERSION__: JSON.stringify(VERSION),
  },
  banner: {
    js: 'var module = { exports: {} }; var exports = module.exports;\n'
      + `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
  },
  footer: { js: 'return module.exports; } });' },
})

await mkdir(dirname(outFile), { recursive: true })
for (const file of result.outputFiles) {
  const target = join(dirname(outFile), file.path.split(/[\\/]/).pop() ?? 'client.js')
  await writeFile(target, file.text, 'utf8')
  console.log(`[build-client] 已生成 ${target}（${file.text.length} 字节）`)
}
