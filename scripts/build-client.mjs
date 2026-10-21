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
 *
 * ## 3D 环为什么单独出一个分片
 *
 * 3D 环要带一整份 three.js（宿主模块表里没有任何 3D 库，第三方库只能自己内联），
 * 压完还有 ~510KB。整包塞进 `lib/client.js` 的话，**每次 DSH web 启动都要多解析 500KB**，
 * 哪怕用户根本不打开用量面板。
 *
 * 宿主支持**包内动态分片**：factory 里的 `require('./client.xxx.js')` 会被外壳
 * 当成包内分片去取（`packages/client/modules/src/client/system.ts` 的 `importChunk`），
 * 分片名必须匹配 `client.<名字>.js`。
 * 所以 three.js 单独打成 `lib/client.usage3d.js`，用到时才拉。
 *
 * 注意：分片里那行 `require` 必须落在 factory 的作用域里，
 * esbuild 对 CJS 产物的外部动态导入正好生成裸 `require("...")`，落在 factory 参数上就对。
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

/** 3D 环分片的文件名：必须匹配宿主约定的 `client.<名字>.js`。 */
const CHUNK_FILE = 'client.usage3d.js'

/** 3D 环分片的源入口。 */
const CHUNK_ENTRY = join(root, 'src', 'client', 'usage-3d.ts')

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
  // 3D 环分片：不是模块表里的名字，是包内分片引用，
  // 保持为外部引用，产物里就是一行 `require("./client.usage3d.js")`，
  // 宿主 factory 的 require 认这个形式（普通 import() 会按页面相对路径去找，找不到）。
  `./${CHUNK_FILE}`,
]

/** 入口产物与分片产物共用的打包选项。 */
const SHARED = {
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: true,
  sourcesContent: true,
  // 产物里内联了 three.js（宿主模块表里没有 3D 库，第三方库只能整包带进来），
  // 不压缩的话光 three 就是 1.2MB；压缩后回到 500KB 上下。
  minify: true,
  logLevel: 'warning',
  define: {
    'process.env.NODE_ENV': '"production"',
    // 底栏的版本号：来自 package.json，源码里不写死。
    __DSH_USAGE_VERSION__: JSON.stringify(VERSION),
  },
}

/**
 * 把 3D 模块的动态导入改写成包内分片引用。
 *
 * 源码里写的是 `require('./client.usage3d.js')`；这里保证它不会被内联进入口产物，
 * 而是留成外部引用，由宿主 factory 的 require 去取分片。
 */
const chunkPlugin = {
  name: 'dsh-chunk',
  setup(b) {
    b.onResolve({ filter: /client\.usage3d\.js$/ }, (args) => {
      if (args.kind === 'entry-point') return undefined
      return { path: `./${CHUNK_FILE}`, external: true }
    })
  },
}

const result = await build({
  ...SHARED,
  entryPoints: [entry],
  outfile: 'client.js',
  external: EXTERNAL,
  plugins: [chunkPlugin],
  banner: {
    js: 'var module = { exports: {} }; var exports = module.exports;\n'
      + `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
  },
  footer: { js: 'return module.exports; } });' },
})

const chunk = await build({
  ...SHARED,
  entryPoints: [CHUNK_ENTRY],
  outfile: CHUNK_FILE,
  banner: {
    js: 'var module = { exports: {} }; var exports = module.exports;\n'
      + `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, chunk: ${JSON.stringify(CHUNK_FILE)}, factory: (require) => {`,
  },
  footer: { js: 'return module.exports; } });' },
})

await mkdir(dirname(outFile), { recursive: true })
for (const file of [...result.outputFiles, ...chunk.outputFiles]) {
  const target = join(dirname(outFile), file.path.split(/[\\/]/).pop() ?? 'client.js')
  await writeFile(target, file.text, 'utf8')
  console.log(`[build-client] 已生成 ${target}（${file.text.length} 字节）`)
}
