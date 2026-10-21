# 步骤 3：数据通道与 Client

**前置条件**：步骤 1 统计正确，步骤 2 文件可读写。

## 为什么不用官方 remotes

harness 的 `ctx.remote.<namespace>` 是给 **harness 内部包** 用的，第三方插件接不上：

1. **Client 装配是静态清单**。Client 应用只装配 `@deepseek-ai/dsh-api-remotes`，
   该包以**运行时值**静态 import 被选业务包的 `/remote` 子路径
   （`packages/api/remotes/src/client/index.ts`）。第三方包无法把自己加进那份清单——
   「增加一个 Host Remote 包是 Client 组合所有者的显式选择」
   （`docs/api-gateway.zh.md`）。
2. **Remote 客户端要求生成产物**。Client 侧的类型、codec 与注册值始终来自
   typert 生成的 `lib/typert.remote-client.*`，由 harness 的 `pnpm run build:lib` 管线产出；
   缺严格 codec 的 SRC 描述符会被 Client Remote 拒绝挂载。

## 实际做法：Connection 的精确 Fetch 路由

第三方插件可用的通道是 `ctx.connection.fetch.register`：
在 Connection 的**认证栅栏**内注册一条精确路由，浏览器用同源 `fetch` 直读。

| 路由 | 方法 | 行为 |
|------|------|------|
| `/api/usage.summary` | GET | 读 JSON，返回 `{ today, d7, d30, byProvider, generatedAt }` |
| `/api/usage.clear` | POST | 清空统计（保留 `retentionDays`） |

服务端路由键是**绝对路径**，浏览器引用是**文档相对**形式
（`USAGE_SUMMARY_PATH` / `USAGE_SUMMARY_ROUTE`，见 `src/protocol.ts`）：
Web 外壳的文档自带 `<base href="./">`，同一份 bundle 在源站根与任意挂载下都成立。

鉴权由 Connection 统一处理：Host/Origin 栅栏 + 浏览器会话 cookie，
与官方 remote 走同一条 `/api` 共享通道。

harness 自己的 `ui-deliverables`（`/api/changes.summary` 等）、`ui-client-file-upload`
都是这个路子。

## Client

- 槽位：**右栏 Tab**——`ctx.sidebarRightTabs.register({ id, kind, title, guide })`
  加上 `sidebar.right.pane.tab` / `sidebar.right.pane.tab.title` 两个 seat 的注册。
- 全局标识的取名（`src/client/index.ts`）：

  | 标识 | 值 | 为什么这么取 |
  |------|----|--------------|
  | `TAB_ID` | `dsh-usage-cmdkit` | **实现身份**，全局唯一，取包名 |
  | `TAB_KIND` | `usage-dashboard` | **类型判别符**，harness 侧一律取短名（`guide` / `files` / `terminal`） |
  | `NS` | `dsh.usage` | 字典命名空间，全局且是 TypeScript 全局声明合并点，带段前缀避开通用裸词 |

  ⚠️ **`TAB_KIND` 不要改名**：右栏每个已打开的 Tab 都把 kind 记进会话的持久化状态，
  改名后旧 Tab 找不到在册的类型，一律显示「这类内容还没有可用的查看方式」。
  `TAB_ID` 与 `NS` 则是纯运行时的，改动没有迁移代价。
- 字典命名空间 `NS` = `dsh.usage`：`LocaleNamespaceMap` 是**所有插件共享**的声明合并点，
  裸词 `usage` 迟早会撞上别人，而撞了会让**对方的包**编译失败，所以带 `dsh.` 段前缀。
- `guide` 条目让用户从右栏引导页打开这个 Tab。
- 数据：`fetch(USAGE_SUMMARY_ROUTE)`（同源），清空：`fetch(USAGE_CLEAR_ROUTE, { method: 'POST' })`。
- 样式用内联 style：浏览器半是独立打包产物，不走 harness 的 CSS Modules 管线。
- 构建：`pnpm run build:client` → `lib/client.js`（esbuild，lazy-CJS factory）。
  产物形态与 harness 的 `clientBundle` 一致：

  ```js
  var module = { exports: {} }; var exports = module.exports;
  window.__ModuleLoader__.load({ id: 'dsh-usage-cmdkit', factory: (require) => {
    /* … CJS 产物 … */
    return module.exports; } });
  ```

  `react` / `react/jsx-runtime` 保持外部引用，由 Web 外壳的模块表解析。

- 联调必须用 **`plugin add`**（`cordis.patch.yml` 裸包名），不要用 `--patch` 测 UI。
- 刷新：再次调用汇总路由；清空：调清空路由后重读。

## 快捷键：插件不占全局键位

插件**不注册全局快捷键**，也不自己往 window 上挂 keydown。

原因很直接：宿主把 `⌘K` / `Ctrl+K` 派给了「搜索会话」
（`ui-workspace` 的 `session.search`），`⌘/` 派给了快捷键手册
（`ui-shortcuts` 的 `shortcuts.open`）。插件自己监听 window 抢同一个键，
两个面板会同时响应——这比没有快捷键更糟。

本插件面板里的操作（切时间窗、刷新、清空）都在面板里点着做，
不值得为它挑一枚不冲突的键位再把改键、冲突检测、键帽渲染都接一遍。
插件侧的 `inject` 里也就没有 `shortcuts` 服务了。

> 将来若真要做命令面板：唤出键要注册在 `ctx.shortcuts.register` 上
> （id 用品牌化 string），**不要自己监听 window**。注册表在注册时就检查重叠，
> 冲突直接抛错；改键与冲突检测是宿主的事；面板上的键帽读
> `ctx.shortcuts.catalog`（含用户改过的绑定），目录还没就绪时按平台推算一枚兜底。

## 面板重挂时状态留在原地

右栏的 Tab 会被宿主随时卸载/重挂——用户切到别的 Tab 再切回来，面板重新挂载一次。
数据放在模块级的 `src/client/data/usage-state.ts`（`useSyncExternalStore` 订阅），
切回来就不用再读一遍，也不会闪一下「正在读取」。

模块级单例是安全的：浏览器半整包在页面里只加载一次
（`window.__ModuleLoader__.load`），同一份模块实例贯穿整个页面。

## 可选 Phase D

Volatile Config：`storagePath`、`retentionDays`（Schema + Configure 或 Dashboard 内编辑）。
