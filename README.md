# dsh-usage-meters

> DSH Web 的本地插件：右侧栏的**用量遥测**（Usage）。

*Local DSH Web plugin — token usage telemetry in the DSH Web sidebar.*

[![npm](https://img.shields.io/npm/v/dsh-usage-meters.svg)](https://www.npmjs.com/package/dsh-usage-meters)
[![license](https://img.shields.io/badge/license-MIT-4c8dff.svg)](https://github.com/xiewg1987/dsh-usage-meters/blob/main/LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--alpha-4c8dff)](https://github.com/deepseek-ai/deepseek-harness)

一个扩展，一个面：

- **Usage** —— 把这台机器上真实发生的 token 用量摊在右侧栏里：四桶拆分、30 天滚动窗口、按来源聚合。

**数据与配置全部留在本机**：不额外调模型、不请求开放平台统计 API、不上传任何东西。

---

## 功能

在 DSH Web 右侧栏增加 **Usage** Tab，把本机发生的 token 用量按 harness 四桶口径（未缓存输入 / 输出 / 缓存读 / 缓存写）按**本地日历日**rollup，再在面板里看总量、趋势和分布。

- **总览** —— 四色环（窄栏为表盘 + 大数）；今日 / 7 日 / 30 日窗口；缓存命中率；四行分类与 30 日折线；涨跌签（今日窗不显示）。
- **Top** —— 按 provider / model 排行；分模型命中率；30 日模型走向与份额变化；宽栏另有「按来源」卡（窄栏让位给走向时仍可从模型行看出 provider）。
- **告警** —— 从日序列与四桶**推导**异常形状（峰值、占比、增速），不满足阈值不报；节律（周末 vs 工作日、连用天数、峰谷比）。
- **布局** —— 按面板**实测宽度**切换窄栏竖屏与宽栏双列（≥900px，带迟滞）；高度变化时宽栏环径自适应，底栏操作常驻。
- **语言** —— 中文 / 英文；v6 暗色界面（桶色只出现在环段与细条上）。

**数据怎么来**

- Host 在 `turn/end` 用 `deriveTurnTokenUsage` 落盘到 profile 下的 JSON；Client 通过 Connection 认证路由读汇总、POST 清空。
- 与 Web「本轮用量」同一套四桶字段，不做费用估算、不上传遥测。
- 多路由 turn 无法拆分时记入 `__mixed__`；读盘异常（损坏 / 版本不兼容）会在面板提示，并尽量不影响继续查看。

**尚未实现**

- 按来源列表的 Top3 + 展开（当前为完整列表）。
- 可配置 `storagePath`、`retentionDays`（见「配置」）。

视觉规格与更多成图见 [design/v6-preview.md](design/v6-preview.md)、[design/v6-visual-direction.md](design/v6-visual-direction.md)。

---

## 截图

宽栏总览（1280×720，由 `UsageWide` 组件渲染导出，非手摆静态稿）：

![宽栏总览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-meters/main/design/dsh-meters-v6-1280x720.png)

窄栏三屏、Top / 告警等其它视角见 [design/v6-preview.md](design/v6-preview.md)。

---

## 安装

从 Git 装（开发 / 预览）：

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh plugin --profile web add github:xiewg1987/dsh-usage-meters
pnpm dsh web
```

从 npm 装：

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh plugin --profile web add dsh-usage-meters
pnpm dsh web
```

> **镜像源**：淘宝源（npmmirror）已同步 `0.1.1`（2026-10-23），默认源即可安装。
> 若你的机器上 `latest` 还指向 `0.0.0-stage`（镜像滞后时 npm 暂存机制留下的空壳占位版），
> 加 `--registry=https://registry.npmjs.org/` 强制走 npmjs——该参数会被透传给 pnpm。

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

当前没有面向用户的配置项。后续可能支持：

- `storagePath` —— 统计文件路径（默认在 DSH profile 下）
- `retentionDays` —— 保留天数（默认 30）

---

## 与 `dsh-kit` 等的区别

市面上同类插件不少，定位容易混。这里划清：

| | `dsh-usage-meters` | 全家桶类（如 `dsh-kit`） |
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
| `lib/client.js`（入口） | ≈69 KB（实测 70,767 B） | 面板打开即加载 |

浏览器半只有**一个产物**：没有 3D 就没有那份 550 KB 的 three.js 分片，
也不需要按需加载那一套机制。


> 下面命令里的仓库目录名按**克隆后的目录**写（`dsh-usage-meters`）。本地已有的工作副本目录可能还叫 `dsh-usage-dashboard`，按实际路径替换即可——目录名不影响运行，包名才影响。

只跑 Host（不挂 client 半）：

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh web --patch ../dsh-usage-meters/patch.dev.yml
```

Host + Client（要跑完整 UI）：

```powershell
cd D:\ScriptProject\dsh-usage-meters
pnpm install
pnpm run typecheck
pnpm run build:client

cd D:\ScriptProject\deepseek-harness
pnpm dsh plugin --profile web add D:/ScriptProject/dsh-usage-meters
pnpm dsh web
```

### 实现要点

- **不回读会话历史。** harness 已弃用 `session.snapshotEvents()`，存储演进后完整事件序列不再保证常驻内存。改为在 `session/event` 流上就地攒一个 turn 的段：`turn/start` 开缓冲、`turn/end` 交出。内存占用与 turn 长度成正比，与会话历史长度无关。
- **不走官方 remotes。** `ctx.remote.<namespace>` 对第三方插件是关闭的（Client 侧是静态清单，第三方包加不进去）。改走 `ctx.connection.fetch.register`，在 Connection 的认证栅栏内注册精确路由，浏览器同源 `fetch` 直读。详见 [docs/steps/03-remotes-and-client.md](https://github.com/xiewg1987/dsh-usage-meters/blob/main/docs/steps/03-remotes-and-client.md)。
- **全局标识取名规则**：`TAB_ID` 取包名（实现身份，全球唯一）；`TAB_KIND` 取短名 `usage-dashboard`（类型判别符，**不要改**——右栏已打开的 Tab 会把 kind 持久化，改名会让它们一律显示「这类内容还没有可用的查看方式」）；locale 命名空间 `dsh.usage`（全局声明合并点，撞名会让**对方的包**编译失败）。
- **插件不注册全局快捷键**。宿主的 `⌘K` 已经派给了「搜索会话」，插件再抢同一个键，两个面板会同时响应；`⌘/` 又是宿主的快捷键手册。与其挑一枚不冲突的键（`⌘J` / `Ctrl+Alt+J`）再把改键、冲突检测、键帽渲染都接一遍，不如**完全不占全局键位**——面板里的操作都在面板里做。
- **样式走内联 style**，不走 CSS Modules——浏览器半是独立打包产物，不进 harness 的 CSS 管线。
- **组件的 `children` 必须从 props 取，不能写成第二个位置参数**。
  React 18 调用函数组件时第二个位置参数是 **legacy context**（一个空对象 `{}`），
  不是 children。写成 `function Icon(props, children)` 再把它渲染出去，
  就会炸 `Objects are not valid as a React child (found: object with keys {})`——
  在 automatic JSX runtime 下（`jsx: 'automatic'`），children 只在 `props.children` 里。
### 文档

- [docs/README.md](https://github.com/xiewg1987/dsh-usage-meters/blob/main/docs/README.md) —— 实施顺序与索引
- [docs/00-项目说明.md](https://github.com/xiewg1987/dsh-usage-meters/blob/main/docs/00-项目说明.md) —— 项目总览与学习文档
- [docs/steps/01-collect-usage-stats.md](https://github.com/xiewg1987/dsh-usage-meters/blob/main/docs/steps/01-collect-usage-stats.md) —— 步骤 1：采集 token 用量
- [docs/steps/02-persist-stats.md](https://github.com/xiewg1987/dsh-usage-meters/blob/main/docs/steps/02-persist-stats.md) —— 步骤 2：持久化 JSON
- [docs/steps/03-remotes-and-client.md](https://github.com/xiewg1987/dsh-usage-meters/blob/main/docs/steps/03-remotes-and-client.md) —— 步骤 3：数据通道与 Client 半
- [docs/guide/步骤1代码详解.md](https://github.com/xiewg1987/dsh-usage-meters/blob/main/docs/guide/步骤1代码详解.md) —— 步骤 1 的逐行学习文档

### 外部参考

- [DSH 插件教程](https://dumplinghuman.github.io/dsh-plugin-tutorial/)（事件 / Cordis）
- [extension-cookbook.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/extension-cookbook.zh.md)（`session/event`）
- [API Gateway 参考](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/api-gateway.zh.md)（remote 通道的边界）
- [Whale Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（本地 JSON 思路，UI 不同）

---

## 迁移

本项目换过两次名：

1. **`dsh-usage-dashboard`** —— 最初的名字，只做用量面板。npm 上该名字已被他人占用（另一个「API 余额 + 今日花费」的侧栏小部件），于是改叫 **`dsh-usage-cmdkit`**。
2. **`dsh-usage-cmdkit`** —— 用了一阵子。后来「cmd」那套叫法作废了，包名里的 `cmdkit` 成了纯负担：产品里根本没有任何命令面板，「CmdKit」这层皮跟实际功能对不上。于是更名为 **`dsh-usage-meters`**。

名字的取舍：npm 上 `dsh-usage*` 已经很挤——`dsh-usage-panel`（官方插件占用，做设置页消耗统计）、`dsh-usage-dashboard`、`dsh-usage-chart`、`dsh-usage-stats`、`dsh-usage-heatmap`、`dsh-usage-badge`、`dsh-usage-monitor`……全被占了。`meters` 空着且没人用过，而它说的正是这个东西：**一组表**（四色环 / 表盘 / 折线 / 条）。品牌随之从「DSH CmdKit」改成「**DSH Meters**」，角标仍是 `USAGE`。

改名**不影响任何已有安装**：本项目此前一直是 `private: true`，从未发布到 npm——npm 上的 `dsh-usage-dashboard` 是**别人的包**（另一个「API 余额 + 今日花费」的侧栏小部件），不要去动它；`dsh-usage-cmdkit` 这个名字则从未被任何人发布过，npm 上至今仍是 404。所以这里没有 npm 侧的迁移，只有两处本地变化：

- **目录名**：本地工作副本的文件夹还叫 `dsh-usage-dashboard`（没跟着改，改了要重装 profile 里的 link），克隆新仓库则是 `dsh-usage-meters`；两者都能跑，按实际路径替换即可。
- **已积累的用量统计文件不受影响**——统计按 DSH profile 路径存放，与包名无关。

> 内部标识（Loader 行 id、Cordis 插件名、`TAB_ID`）已随包名一并加固，`TAB_KIND` 有意保持 `usage-dashboard` 不变，原因见「实现要点」。

---

## License

[MIT](https://github.com/xiewg1987/dsh-usage-meters/blob/main/LICENSE) —— 除非另有说明。
