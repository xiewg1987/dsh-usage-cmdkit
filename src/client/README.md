# Client 半（浏览器）

右栏的**用量 Tab**。步骤 3 见 **docs/03-remotes-and-client.md**。

> 一个面：用量面板。命令面板与费用估算都已从插件里去掉——
> 前者会把插件的定位撑成「命令面板」，后者报的是猜出来的钱。
> 插件现在只做一件事：把本机真实的 token 用量摊在右栏里。

| 文件 | 作用 |
|------|------|
| `index.ts` | 浏览器半入口：注册 locale 字典、右栏 tab 类型与两个 seat |
| `UsageDashboard.tsx` | 用量面板本体（宽版）：3D 轨道矩阵双栏、时间窗切换、按来源列表、刷新/清空 |
| `UsageCompact.tsx` | 用量面板本体（窄版，<900px）：金融竖屏构图 |
| `UsageChrome.tsx` | v4 外框件：底纹、品牌头、视图 Tab、时间窗、指标、底栏 |
| `UsageRing.tsx` | 主环：四段弧、环心总览、环外图例 |
| `UsageRing3D.tsx` | 3D 环宿主：canvas + DOM 读数覆盖层 + 降级到 SVG 环 |
| `usage-3d.ts` | three.js 场景：鳍片环、底轨、刻度、数据轨、读取头 |
| `UsageTelemetry.tsx` | 四行遥测列表：名字与数量中性色，条形用品类色 |
| `usage-theme.ts` | 设计令牌：近黑底、单一强调色、四个品类的玻璃渐变 |
| `UsageTitle.tsx` | Tab 的标题 |
| `usage-client.ts` | 读汇总 / 清空两个路由 |
| `usage-state.ts` | 共享状态：用量数据、时间窗、清空中 |
| `usage-metrics.ts` | 命中率等比率算式 |
| `usage-motion.ts` | 入场编排的时间表与 Web Animations 原语 |
| `usage-version.ts` | 构建期注入的包版本号 |
| `locales.ts` | 中英文案（zh 是键集的事实来源） |

视觉基调是「深空遥测台」：近黑底、唯一强调色电光蓝，
四色只出现在环段、进度条与它们的图例上，正文文字一律中性灰阶。
面板自带深色表面，不依赖宿主明暗主题。

布局由面板**实测宽度**决定（`ResizeObserver` 量面板自己）：
宽到 900px 以上用左环右数据的 3D 轨道矩阵版，
不到 900px 用金融竖屏那一版（大数 + 小环 + 指标卡 + 分类列表）。

不看 `useTabInfo().sidebar.fullscreen`：那个标志只说明「面板盖住了整块视口」，
窗口窄的时候右栏反而会自动全屏，那时可用宽度更小——按标志选布局会套错构图。

两种形态共用同一套组件与令牌。

**状态住在模块级**：右栏的 Tab 会被宿主随时卸载/重挂，用户切走再切回来
面板要重新挂载一次。数据放在模块级的 `usage-state.ts`（`useSyncExternalStore`）里，
切回来就不用再读一遍，也不会闪一下「正在读取」。

**插件不注册全局快捷键**：宿主已经把 `⌘K` 派给了「搜索会话」，
插件再抢同一个键两个面板会同时响应。面板里的操作都在面板里做。

数据来自 Host 在 Connection 认证通道里注册的 `/api/usage.summary` 与 `/api/usage.clear`，
浏览器用同源 `fetch` 直读。地址常量在共享契约 `src/protocol.ts`。

构建：`pnpm run build:client` → `lib/client.js`（产物，不入库）。
