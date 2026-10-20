# Client 半（浏览器）

右栏 Tab 的用量 Dashboard。步骤 3 见 **docs/03-remotes-and-client.md**。

| 文件 | 作用 |
|------|------|
| `index.ts` | 浏览器半入口：注册 locale 字典、右栏 tab 类型与两个 seat |
| `UsageDashboard.tsx` | 面板本体：两套布局（侧栏堆叠 / 全屏 hero）、时间窗切换、按来源列表、刷新/清空 |
| `UsageRing.tsx` | 主环：四段弧、环心总览、环外图例 |
| `UsageTelemetry.tsx` | 四行遥测列表：名字与数量中性色，条形用品类色 |
| `usage-theme.ts` | 设计令牌：近黑底、单一强调色、四个品类的玻璃渐变 |
| `UsageTitle.tsx` | Tab 标题 |
| `usage-client.ts` | 读汇总 / 清空两个路由 |
| `locales.ts` | 中英文案（zh 是键集的事实来源） |

视觉基调是「深空遥测台」：近黑底、唯一强调色电光蓝，
四色只出现在环段、进度条与它们的图例上，正文文字一律中性灰阶。
面板自带深色表面，不依赖宿主明暗主题。

布局由面板**实测宽度**决定（`ResizeObserver` 量面板自己）：
宽到 1200px 以上用左列表右主环的 hero 版，否则用环在上、遥测在下的堆叠版。

不看 `useTabInfo().sidebar.fullscreen`：那个标志只说明「面板盖住了整块视口」，
窗口窄的时候右栏反而会自动全屏，那时可用宽度更小——按标志选布局会套错构图。

两种形态共用同一套组件与令牌。

数据来自 Host 在 Connection 认证通道里注册的 `/api/usage.summary` 与 `/api/usage.clear`，
浏览器用同源 `fetch` 直读。地址常量在共享契约 `src/protocol.ts`。

构建：`pnpm run build:client` → `lib/client.js`（产物，不入库）。
