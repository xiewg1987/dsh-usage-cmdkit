/**
 * 插件版本号：构建时注入。
 *
 * 底栏要写清「这是哪一版」——面板改版时，旧截图和新区一眼就能分开。
 * 版本号从 `package.json` 来，所以只有一个事实来源：
 * 构建脚本把它 define 进来，运行时读那个常量。
 *
 * 没被 define 时（源码直接跑、预览脚本漏了 define）退回 `0.0.0-dev`，
 * 不用 `typeof` 守卫以外的写法：未声明的标识符在 `typeof` 下是安全的。
 */
declare const __DSH_USAGE_VERSION__: string

/** 插件版本号。 */
export const PLUGIN_VERSION: string =
  typeof __DSH_USAGE_VERSION__ === 'string' ? __DSH_USAGE_VERSION__ : '0.0.0-dev'
