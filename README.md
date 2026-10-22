# dsh-usage-cmdkit

> DSH Web 的本地插件：右侧栏的**用量遥测**（Usage）。

*Local DSH Web plugin — token usage telemetry in the DSH Web sidebar.*

[![npm](https://img.shields.io/npm/v/dsh-usage-cmdkit.svg)](https://www.npmjs.com/package/dsh-usage-cmdkit)
[![license](https://img.shields.io/badge/license-MIT-4c8dff.svg)](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--alpha-4c8dff)](https://github.com/deepseek-ai/deepseek-harness)

一个扩展，一个面：

- **Usage** —— 把这台机器上真实发生的 token 用量摊在右侧栏里：四桶拆分、30 天滚动窗口、按来源聚合。

**数据与配置全部留在本机**：不额外调模型、不请求开放平台统计 API、不上传任何东西。

---

## 状态

| 能力 | 状态 |
|------|------|
| Usage 四色环（未缓存输入 / 输出 / 缓存读 / 缓存写） | ✅ 已发布 |
| 时间窗切换（今日 / 7 日 / 30 日） | ✅ 已发布 |
| 按来源聚合（provider / model） | ✅ 已发布 |
| 刷新 / 清空 | ✅ 已发布 |
| 多分辨率布局（窄栏三屏 / 宽面板 hero） | ✅ 已发布 |
| v6 视觉 + 入场动效 | ✅ 已发布 |
| 中英文文案 | ✅ 已发布 |
| 缓存命中率指标（命中 / 总输入） | ✅ 已发布 |
| v6 竖屏视觉（大数 + 涨跌签 + 折线 + 表盘 + 两枚 stat + 行内微折线） | ✅ 已发布 |
| 三屏 + 一态骨架（总览 / Top / 告警） | ✅ 已发布 |
| 分模型缓存命中率（每个模型各算各的） | ✅ 已发布 |
| 模型走向（逐模型 30 日微折线 + 份额变化） | ✅ 已发布 |
| 节律（周末 vs 工作日、连用天数、峰谷比） | ✅ 已发布 |
| Alerts 阈值告警（不满足阈值就不报） | ✅ 已发布 |
| Top3 截断（当前按来源是完整列表） | 🚧 计划中 |

🚧 = 计划中 / 开发中，尚未进主干。下面的功能清单会标注每一项的状态。

> 上一版设计稿里的 Top / Alerts 标签、日均 sparkline 都进主干并出了 v6 成图；
> 还剩 **Top3 截断**没做——按来源那张卡仍是完整列表。

---

## 功能

### Usage —— 用量遥测侧栏

DSH Web 右侧栏多一个「用量」Tab。视觉基调是「暗色金融终端的密度，Apple 备忘录的克制」：近黑底、界面强调色只有蓝青一种，四色（`#4c8dff` / `#22c55e` / `#a855f7` / `#f59e0b`）只出现在环段、圆点与细条上，正文一律中性灰阶。

**已发布**

- **四色环** —— 未缓存输入 / 输出 / 缓存读 / 缓存写四桶占比，环心是所选窗口的总量与日均值；环外标百分比，某一桶独大时其余标签自动让位，不叠字。
- **时间窗** —— 今日 / 7 日 / 30 日，滚动窗口按本地日历日切分。
- **单指标** —— 缓存命中率（缓存读 /（未缓存输入 + 缓存读））。
- **按来源** —— 按 provider / model 聚合的用量列表。
- **刷新 / 清空** —— 重新读汇总；清空会把本地统计文件重置。
- **自适应布局** —— 按面板**实测宽度**选布局（≥900px 走双栏 hero 版，860px 以下回落窄栏，带迟滞免得来回横跳），不按 `sidebar.fullscreen`——窗口窄时右栏会自动全屏，那时可用宽度反而更小。窄栏堆叠、宽面板左环右数据。
- **一屏装下** —— 右栏的高度随窗口变，固定尺寸的设计稿定不了这件事，所以面板在运行时量：内容比一屏高多少，宽栏的环就缩多少（环径下限 190px，窗口矮于 720px 时再收到 118px）。底栏（刷新 / 清空）永远可见。
- **v6 视觉与入场动效** —— 近黑底、唯一强调色蓝青；入场按编排落位（品牌头 → 视图 Tab / 时间窗 → 环与弧 → 指标 → 四行遥测 → 洞察 → 底栏），刷新走插值不重播。
- **主环是扁平的** —— 四段色弧 + 环心读数 + 环外百分比，纯 SVG，**不做 3D**：透视没法转矢量、在窄栏上又占地方，代价大于收益。

**计划中**

- Top3 截断（当前按来源是完整列表）。

### 两条取舍

- **数据不出本机。** 统计写在 DSH profile 下的本地 JSON，Client 经认证路由读回。没有遥测上报、没有账号、没有后端。
- **不重复造轮子。** token 计数直接复用 harness 自己的 `TokenUsageProjection` 四桶口径（`uncachedInputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens`，缺项按 0），与 Web「本轮用量」一致——不做第二套估算。

---

## 截图

### v6 · 两套构图

面板有**两套构图**：窄栏（不到 900px）走**竖屏**那一版；
宽面板（≥900px，右栏切「全屏」时）走 **大号扁平环**双栏。
判据是面板**实测宽度**，不是 `sidebar.fullscreen` 标志——
窗口窄时右栏会自动全屏，那时可用宽度反而更小。

| 宽面板（大号扁平环，1280×720） | 窄栏（竖屏，360×800） |
|---|---|
| ![宽面板](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-1280x720.png) | ![窄栏](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-360x800.png) |

> 这几张是**真实组件**渲染出来的（`design/_v6_src/render-preview.mjs` 挂载
> `src/client/views/UsageWide.tsx` / `src/client/views/UsageCompact.tsx` 后用 Chrome 截的），
> 不是另画的静态稿。逐块对照表、视觉规矩与**实现偏差**见
> [design/v6-preview.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/design/v6-preview.md)。

### v6 · 窄栏重做（360×800）

窄栏（不到 900px 的右栏）从 v5.1 的「金融竖屏」再改一版，按
[design/v6-visual-direction.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/design/v6-visual-direction.md)
重排：**上密下疏**，大数下面加了涨跌签与折线，右侧的环改成命中率表盘，
指标卡从一枚高卡变成两枚横排，分类行加了行内微折线，洞察卡变成
「小标题 + 说明 + 占比条」三层，底栏加了状态点。

这一轮把窄栏从**一屏**拆成**三屏 + 一态骨架**：顶部的
`OVERVIEW / TOP / ALERTS` 原本只是占位（除第一个全被禁用），
现在是真开关——总览看整体、Top 看谁花的、告警看形状不对的地方，
读数的时候身体换成骨架。三屏换的是身体，头永远一样。

| 总览 | Top | 告警 | Loading 骨架 |
|---|---|---|---|
| ![总览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-360x800.png) | ![Top](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-top-360x800.png) | ![告警](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-alerts-360x800.png) | ![Loading](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-loading-360x800.png) |

竖屏整屏只留**一种彩色**：四个 token 桶用同一色相的四档亮度表示
（不是四种色相并排），涨跌签、指标条、洞察条一律走界面蓝青。
告警的数字**全是推出来的**（峰值、占比爬升、增速掉队），
不满足阈值就不报——面板只报 token，不报钱，也不假装有事。

这一轮又补了**三组本来就在数据里、只是没被用起来**的统计：

- **分模型缓存命中率**（Top 屏）：全局命中率是加权平均，量大的模型说了算；
  真正该看的是「量跑在哪儿」——所以每个模型各算各的。
  竖屏并进模型排行做一列，宽版独立成一张 `CACHE HIT` 卡。
- **模型走向**（Top 屏）：每个模型 30 日的微折线 + 份额变化，
  看谁在抢份额、谁在让份额。宿主本来每天每模型都存着四桶，
  这一层只是把它摊开——**不迁数据、不改文件格式**。
- **节律**（告警屏）：周末比工作日省多少、连着用了几天、峰谷比（峰值÷中位数）。

窄屏一屏只装得下这么多，所以窄屏**挤进已有的卡**、宽版**独立成卡**——
信息一样，密度不同。竖屏 Top 屏那张「按来源」卡在窄屏让位给了模型走向：
它那两行本来就是模型行按 provider 求和的结果，信息是重复的。
三屏都核对过高度，一屏装得下，不切不裁。

> 逐块对照表、视觉规矩与**实现偏差**见 [design/v6-preview.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/design/v6-preview.md)。

### v6 · 宽栏重做（1280×720）

宽栏（≥900px）的卡片与标签与竖屏**同一套语言**：分段控件、描边药丸、
两枚横排指标块、带行内微折线的分类列表、三层洞察卡、绿点底栏——
满屏网格与发光规则线删干净。主视觉是一枚大号扁平环（不再是 3D 轨道矩阵），
环**只留色、不留外发光**——四段桶色弧是 v6 令牌允许的位置，但弧上没有辉光、环心没有能量核。

![宽版 1280×720](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-1280x720.png)

宽版也是三屏。Top 屏多一张 `CACHE HIT` 卡和一张 `MODEL TREND` 卡，告警屏多一张 `RHYTHM` 卡：

| 宽版 Top | 宽版告警 |
|---|---|
| ![宽版 Top](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-top-1280x768.png) | ![宽版告警](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-alerts-1280x960.png) |

> 宽版是**独立组件**（`src/client/views/UsageWide.tsx`），不是把竖屏拉宽：
> 环的大小是**量出来的**（面板比一屏高多少就把环压小多少），
> 因为宿主右栏的高度随窗口变，固定尺寸定不了这件事。

（`UsageSummary.daily`，30 日零填充、旧→新）。涨跌签比的是
「当前窗口日均 vs 前一等长窗口日均」，30 日窗退化成后 15 天 vs 前 15 天；
**比不出来就不画**。

**稿子与实现同源**：Figma 里那帧（页 `v6 · 视觉方向与参考`）的坐标与矢量
**由实现渲染导出**（`PREVIEW_DUMP=1` 出几何表、`PREVIEW_SVG=1` 出 SVG），
不是照着成图手摆的——改实现后重跑脚本即可同步。

竖屏这一版**不含**花费估算与命令入口：视图 Tab 因此只剩 `总览 / Top / 告警`
（没有「花费」），底栏是状态条 + 刷新 / 清空（两枚按钮各带一枚 11px Lucide 图标，
但**保留文字标签**——清空不可撤销，不能只给一个垃圾桶）。

---

## 安装

<!-- TODO(发布)：包发布前先占位，发布后核对下面的命令 -->

从 Git 装（开发 / 预览）：

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh plugin --profile web add github:xiewg1987/dsh-usage-cmdkit
pnpm dsh web
```

从 npm 装（发布后）：

```powershell
npm i -g dsh-usage-cmdkit
cd D:\ScriptProject\deepseek-harness
pnpm dsh plugin --profile web add dsh-usage-cmdkit
pnpm dsh web
```

装载完在 DSH Web 右侧栏就能看到「用量」Tab。

> 同一个 profile 里 `plugin add` 与 `--patch` **不要混用**：patch 形式的 `name: './src/index.ts'` 不会挂载浏览器半（client half）。

### 兼容版本

本插件当前对齐 **DSH `0.2.1-alpha.1`**，运行时依赖 `@deepseek-ai/dsh-token-meter` **钉死在该版本**（不是范围）。

原因：harness 在装载插件前会做兼容性预检——插件的 `peerDependencies` 里的 `@deepseek-ai/dsh-*` 必须满足**运行时版本**，否则那一行会被直接禁用。而插件自身的 `dependencies` 会落进 profile 的 `node_modules`，**顶替宿主自己那份同名包**；版本不一致时，被顶替的那行就会因兼容性预检失败而被禁用。

所以：换 DSH 版本时，要同步换掉 `package.json` 里 `dependencies` 的版本号。

> 逃生口：宿主提供了 `dsh plugin allow-version`，可以显式豁免某个精确版本组合。

---

## 使用

**打开 Usage**：DSH Web 右侧栏 → 「用量」Tab。也可以从右栏引导页（guide）里挑这个入口。

**刷新与清空**：用量面板底部有「刷新」与「清空」。清空会删除本地统计记录，**不可撤销**。

---

## 配置

<!-- TODO(配置)：下列项均未实现 -->

当前**没有任何配置项**。计划中：

| 配置 | 说明 | 状态 |
|------|------|------|
| `storagePath` | 统计文件路径（默认 DSH profile 下） | 🚧 计划中 |
| `retentionDays` | 保留天数（默认 30） | 🚧 计划中 |

---

## 与 `dsh-kit` 等的区别

市面上同类插件不少，定位容易混。这里划清：

| | `dsh-usage-cmdkit` | 全家桶类（如 `dsh-kit`） |
|---|---|---|
| 范围 | 用量遥测 | 页面终端、文件树、编辑器等一整套 |
| 数据 | 只读 harness 本地 token 记录 | 各模块自有数据源 |
| 状态 | 统计文件与配置全在本机 | 视模块而定 |
| 目标 | 把「花了多少、花在哪」这一件事做扎实 | 覆盖广 |

一句话：**本项目不是页面终端 / 文件树全家桶**，专注用量这一件事。

---

## 开发

### 目录

```
src/
  index.ts           Host 入口：session/event → deriveTurnTokenUsage → 落盘
  turn-events.ts     turn 事件收集器（事件流 buffer，不回读会话历史）
  usage-store.ts     日 rollup 持久化与汇总（JSON）
  host-routes.ts     Connection 认证路由：/api/usage.summary、/api/usage.clear
  protocol.ts        Host / Client 共享的常量与类型（只有常量与类型）
  client/            浏览器半（右栏的一个 Tab），按类型分目录
    index.ts         槽位注册、locale 命名空间、TAB_ID / TAB_KIND
    usage-version.ts 构建期注入的包版本号
    views/
      UsageDashboard.tsx  调度层：量面板宽度、选布局、传参
      UsageWide.tsx    宽栏（≥900px）那一版：大号扁平环 + 两列卡片
      UsageCompact.tsx 窄栏（<900px）那一版：v6 竖屏构图
    components/
      UsageChrome.tsx  外框件：品牌头、分段控件、时间窗、洞察卡、底栏
      UsageMeters.tsx  读数件：折线 / 小表盘 / 涨跌签 / 指标块 / 分段控件
      UsageRing.tsx    主环：四段弧 + 环心总览 + 环外百分比
      UsageTelemetry.tsx 四行遥测列表
      UsageTitle.tsx   Tab 的标题
      usage-icons.tsx  Lucide 图标（ISC，路径原样搬入，不加 npm 依赖）
    data/
      usage-ring-geometry.ts  环与分类列表共用的分段与标签规则
      usage-metrics.ts 比率算式、日序列折线、窗口涨跌
      usage-client.ts  取数与窗口状态
      usage-state.ts   共享状态（用量数据 / 时间窗 / 清空状态）
    theme/
      usage-theme.ts   视觉常量
      usage-buttons.ts 底栏 ghost 按钮样式（预览与实现共用一份）
    motion/
      usage-motion.ts  入场编排的时间表与 Web Animations 原语
    i18n/
      locales.ts      zh 为键集事实来源，en 同键集
scripts/
  build-client.mjs   浏览器半 → lib/client.js（入口）
docs/                实施文档（00 统一说明 + steps/ 步骤文档 + guide/ 学习文档）
design/              视觉稿（成图入库，源文件在 _v4_src/ / _v6_src/，本地）
cordis.patch.yml     插件装载行（裸包名才会加载 client 半）
patch.dev.yml        Host 源码联调（不加载 client 半）
tsconfig.json        类型检查配置
tsconfig.build.json  Host 半构建配置（→ lib/index.js）
pnpm-workspace.yaml  pnpm 11 的包级设置（esbuild 构建白名单）
LICENSE
```

### scripts

```powershell
pnpm install
pnpm run typecheck      # tsc --noEmit
pnpm run build          # Host 半 + 浏览器半（产物，不入库）
pnpm run build:host     # → lib/index.js（Host 半，发布用）
pnpm run build:client   # → lib/client.js（浏览器半）
```

> `pnpm run build` 也会在 `npm publish` 前自动跑（`prepublishOnly`）。
> 仓库根的 `pnpm-workspace.yaml` 放行了 esbuild 的构建脚本——它要靠 postinstall 落地平台二进制。

### 产物体积

| 产物 | 体积 | 什么时候拉 |
|------|------|-----------|
| `lib/client.js`（入口） | ≈34 KB | 面板打开即加载 |

浏览器半只有**一个产物**：没有 3D 就没有那份 550 KB 的 three.js 分片，
也不需要按需加载那一套机制。


> 下面命令里的仓库目录名按**克隆后的目录**写（`dsh-usage-cmdkit`）。本地已有的工作副本目录可能还叫 `dsh-usage-dashboard`，按实际路径替换即可——目录名不影响运行，包名才影响。

只跑 Host（不挂 client 半）：

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh web --patch ../dsh-usage-cmdkit/patch.dev.yml
```

Host + Client（要跑完整 UI）：

```powershell
cd D:\ScriptProject\dsh-usage-cmdkit
pnpm install
pnpm run typecheck
pnpm run build:client

cd D:\ScriptProject\deepseek-harness
pnpm dsh plugin --profile web add D:/ScriptProject/dsh-usage-cmdkit
pnpm dsh web
```

### 实现要点

- **不回读会话历史。** harness 已弃用 `session.snapshotEvents()`，存储演进后完整事件序列不再保证常驻内存。改为在 `session/event` 流上就地攒一个 turn 的段：`turn/start` 开缓冲、`turn/end` 交出。内存占用与 turn 长度成正比，与会话历史长度无关。
- **不走官方 remotes。** `ctx.remote.<namespace>` 对第三方插件是关闭的（Client 侧是静态清单，第三方包加不进去）。改走 `ctx.connection.fetch.register`，在 Connection 的认证栅栏内注册精确路由，浏览器同源 `fetch` 直读。详见 [docs/steps/03-remotes-and-client.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/steps/03-remotes-and-client.md)。
- **全局标识取名规则**：`TAB_ID` 取包名（实现身份，全球唯一）；`TAB_KIND` 取短名 `usage-dashboard`（类型判别符，**不要改**——右栏已打开的 Tab 会把 kind 持久化，改名会让它们一律显示「这类内容还没有可用的查看方式」）；locale 命名空间 `dsh.usage`（全局声明合并点，撞名会让**对方的包**编译失败）。
- **插件不注册全局快捷键**。宿主的 `⌘K` 已经派给了「搜索会话」，插件再抢同一个键，两个面板会同时响应；`⌘/` 又是宿主的快捷键手册。与其挑一枚不冲突的键（`⌘J` / `Ctrl+Alt+J`）再把改键、冲突检测、键帽渲染都接一遍，不如**完全不占全局键位**——面板里的操作都在面板里做。
- **样式走内联 style**，不走 CSS Modules——浏览器半是独立打包产物，不进 harness 的 CSS 管线。
- **组件的 `children` 必须从 props 取，不能写成第二个位置参数**。
  React 18 调用函数组件时第二个位置参数是 **legacy context**（一个空对象 `{}`），
  不是 children。写成 `function Icon(props, children)` 再把它渲染出去，
  就会炸 `Objects are not valid as a React child (found: object with keys {})`——
  在 automatic JSX runtime 下（`jsx: 'automatic'`），children 只在 `props.children` 里。
### 文档

- [docs/README.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/README.md) —— 实施顺序与索引
- [docs/00-项目说明.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/00-项目说明.md) —— 项目总览与学习文档
- [docs/steps/01-collect-usage-stats.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/steps/01-collect-usage-stats.md) —— 步骤 1：采集 token 用量
- [docs/steps/02-persist-stats.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/steps/02-persist-stats.md) —— 步骤 2：持久化 JSON
- [docs/steps/03-remotes-and-client.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/steps/03-remotes-and-client.md) —— 步骤 3：数据通道与 Client 半
- [docs/guide/步骤1代码详解.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/guide/步骤1代码详解.md) —— 步骤 1 的逐行学习文档

### 外部参考

- [DSH 插件教程](https://dumplinghuman.github.io/dsh-plugin-tutorial/)（事件 / Cordis）
- [extension-cookbook.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/extension-cookbook.zh.md)（`session/event`）
- [API Gateway 参考](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/api-gateway.zh.md)（remote 通道的边界）
- [Whale Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（本地 JSON 思路，UI 不同）

---

## 迁移

本项目此前叫 **`dsh-usage-dashboard`**，当时只做用量面板。npm 上该名字已被他人占用（另一个「API 余额 + 今日花费」的侧栏小部件），因此更名为 **`dsh-usage-cmdkit`**。

改名**不影响任何已有安装**：本项目此前一直是 `private: true`，从未发布到 npm——npm 上的 `dsh-usage-dashboard` 是**别人的包**（另一个「API 余额 + 今日花费」的侧栏小部件），不要去动它。所以这里没有 npm 侧的迁移，只有两处本地变化：

- **目录名**：本地工作副本的文件夹可能还叫 `dsh-usage-dashboard`，克隆新仓库则是 `dsh-usage-cmdkit`；两者都能跑，按实际路径替换即可。
- **已积累的用量统计文件不受影响**——统计按 DSH profile 路径存放，与包名无关。

> 内部标识（Loader 行 id、Cordis 插件名、`TAB_ID`）已随包名一并加固，`TAB_KIND` 有意保持 `usage-dashboard` 不变，原因见「实现要点」。

---

## License

[MIT](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/LICENSE) —— 除非另有说明。
