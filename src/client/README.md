# Client 半（浏览器）

右栏的**两个 Tab**：用量 Dashboard 与命令面板。步骤 3 见 **docs/03-remotes-and-client.md**。

> 两个面都已进主干。命令面板是右栏的**第二个 Tab**（kind `usage-commands`），
> 由 `⌘J` / `Ctrl+Alt+J` 唤起；唤出键注册在**宿主的快捷键目录**里
> （`ctx.shortcuts.register`，id `dsh.usage.palette`），
> 所以能在 DSH 自己的快捷键设置里改键，冲突也由宿主检测。

| 文件 | 作用 |
|------|------|
| `index.ts` | 浏览器半入口：注册 locale 字典、两个右栏 tab 类型与两个 seat、命令面板的全局快捷键 |
| `UsageDashboard.tsx` | 用量面板本体：两套布局（侧栏堆叠 / 全屏 hero）、时间窗切换、按来源列表、刷新/清空 |
| `UsageCommands.tsx` | 命令面板：搜索、分组命令列表、面板内加速键、导出反馈 |
| `UsageChrome.tsx` | v4 外框件：底纹、品牌头、视图 Tab、时间窗、双指标、命令入口条、底栏 |
| `UsageRing.tsx` | 主环：四段弧、环心总览、环外图例 |
| `UsageRing3D.tsx` | 3D 环宿主：canvas + DOM 读数覆盖层 + 降级到 SVG 环 |
| `usage-3d.ts` | three.js 场景：鳍片环、底轨、刻度、数据轨、读取头 |
| `UsageTelemetry.tsx` | 四行遥测列表：名字与数量中性色，条形用品类色 |
| `usage-theme.ts` | 设计令牌：近黑底、单一强调色、四个品类的玻璃渐变 |
| `UsageTitle.tsx` / `UsageCommandsTitle.tsx` | 两个 Tab 的标题 |
| `usage-client.ts` | 读汇总 / 清空两个路由 |
| `usage-state.ts` | 两个 Tab 共享的状态：用量数据、时间窗、清空中、快捷键环境、导航入口 |
| `usage-keys.ts` | 键帽按平台与运行时渲染（macOS 连写，其余 `+` 连接） |
| `usage-export.ts` | 导出：JSON / CSV 的内容与落地（纯函数 + 剪贴板 / 下载） |
| `locales.ts` | 中英文案（zh 是键集的事实来源） |

视觉基调是「深空遥测台」：近黑底、唯一强调色电光蓝，
四色只出现在环段、进度条与它们的图例上，正文文字一律中性灰阶。
面板自带深色表面，不依赖宿主明暗主题。

布局由面板**实测宽度**决定（`ResizeObserver` 量面板自己）：
宽到 1200px 以上用左列表右主环的 hero 版，否则用环在上、遥测在下的堆叠版。

不看 `useTabInfo().sidebar.fullscreen`：那个标志只说明「面板盖住了整块视口」，
窗口窄的时候右栏反而会自动全屏，那时可用宽度更小——按标志选布局会套错构图。

两种形态共用同一套组件与令牌。

**两个 Tab 共享状态**：命令面板里「切到 30 日」要真的改到用量面板的环上，
所以数据与时间窗住在模块级的 `usage-state.ts`（`useSyncExternalStore`），
不在组件的 `useState` 里。

数据来自 Host 在 Connection 认证通道里注册的 `/api/usage.summary` 与 `/api/usage.clear`，
浏览器用同源 `fetch` 直读。地址常量在共享契约 `src/protocol.ts`。

构建：`pnpm run build:client` → `lib/client.js`（产物，不入库）。
