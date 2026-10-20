# dsh-usage-cmdkit

> DSH Web 的本地插件：右侧栏的**用量遥测**（Usage）+ 全局**命令面板**（Commands）。

*Local DSH Web plugin — usage telemetry in the sidebar, plus a global command palette (Ctrl+K / ⌘K).*

[![npm](https://img.shields.io/npm/v/dsh-usage-cmdkit.svg)](https://www.npmjs.com/package/dsh-usage-cmdkit)
[![license](https://img.shields.io/badge/license-MIT-4c8dff.svg)](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--alpha-4c8dff)](https://github.com/deepseek-ai/deepseek-harness)

一个扩展，两个面：

- **Usage** —— 把这台机器上真实发生的 token 用量摊在右侧栏里：四桶拆分、30 天滚动窗口、按来源聚合。
- **Commands** —— 全局可搜索命令面板（`⌘K` / `Ctrl+K`）：聚焦输入、复制上一条回复、跳到 Usage、切换时间窗、导出。

**数据与配置全部留在本机**：不额外调模型、不请求开放平台统计 API、不上传任何东西。

---

## 状态

| 能力 | 状态 |
|------|------|
| Usage 四色环（未缓存输入 / 输出 / 缓存读 / 缓存写） | ✅ 已发布 |
| 时间窗切换（今日 / 7 日 / 30 日） | ✅ 已发布 |
| 按来源聚合（provider / model） | ✅ 已发布 |
| 刷新 / 清空 | ✅ 已发布 |
| 多分辨率布局（窄栏堆叠 / 宽面板 hero） | ✅ 已发布 |
| v4 视觉 + 入场动效 | ✅ 已发布 |
| 3D 轨道矩阵（three.js，无 WebGL 自动降级） | ✅ 已发布 |
| 中英文文案 | ✅ 已发布 |
| 缓存命中率指标（命中 / 总输入） | ✅ 已发布 |
| 花费估算（内置默认费率表） | ✅ 已发布 |
| 可配置单价表 | 🚧 计划中 |
| 日均 sparkline（当前只有日均值） | 🚧 计划中 |
| Top3 截断（当前按来源是完整列表） | 🚧 计划中 |
| Alerts 阈值告警 | 🚧 计划中 |
| Copy JSON / Export CSV | 🚧 计划中 |
| **Commands 命令面板（⌘K / Ctrl+K）** | 🚧 **开发中** |
| 快捷键改键 + 冲突检测 | 🚧 计划中 |

🚧 = 计划中 / 开发中，尚未进主干。下面的功能清单会标注每一项的状态。

> 花费估算用的是**内置的默认费率**（DeepSeek V4.1-Flash 的公开 off-peak 价），
> 写在 `src/client/usage-pricing.ts` 的常量里，**当前不能配置，费率也会过时**——
> 数字只当量级参考，别当账单。可配置的单价表仍在计划中。

> 「计划中」不是空话——**v4 设计稿已经画完了**（见 [截图](#截图)）：Usage 的
> Cost / Top / Alerts 标签、缓存命中率、花费估算、日均 sparkline、Top3、导出动作，
> 以及整个 ⌘K 命令面板，都在设计稿里等着实现。设计稿是这轮打磨的目标形态。

---

## 功能

### Usage —— 用量遥测侧栏

DSH Web 右侧栏多一个「用量」Tab。视觉基调是克制的科幻 HUD：近黑底、唯一强调色电光蓝，四色（`#4c8dff` / `#22c55e` / `#a855f7` / `#f59e0b`）只出现在环段、进度条与图例文字上，正文一律中性灰阶。

**已发布**

- **四色环** —— 未缓存输入 / 输出 / 缓存读 / 缓存写四桶占比，环心是所选窗口的总量与日均值；环外标百分比，某一桶独大时其余标签自动让位，不叠字。
- **时间窗** —— 今日 / 7 日 / 30 日，滚动窗口按本地日历日切分。
- **双指标** —— 缓存命中率（缓存读 /（未缓存输入 + 缓存读））与花费估算（内置默认费率，量级参考）。
- **按来源** —— 按 provider / model 聚合的用量列表。
- **刷新 / 清空** —— 重新读汇总；清空会把本地统计文件重置。
- **自适应布局** —— 按面板**实测宽度**选布局（≥900px 走双栏 hero 版，860px 以下回落窄栏，带迟滞免得来回横跳），不按 `sidebar.fullscreen`——窗口窄时右栏会自动全屏，那时可用宽度反而更小。窄栏堆叠、宽面板左环右数据。
- **一屏装下** —— 右栏的高度随窗口变，固定尺寸的设计稿定不了这件事，所以面板在运行时量：内容比一屏高多少，环就缩多少（环径下限 118px）；窗口矮于 820px 时再切一档「紧凑密度」（行距、字号、环径下限一起收紧）。实测 360×720 到 1280×900 各档都是零滚动条，底栏（刷新 / 清空）永远可见。
- **v4 视觉与入场动效** —— 近黑底 + 平视网格底纹 + 唯一强调色电光蓝；入场按编排落位（品牌头 → 视图 Tab / 时间窗 → 环与弧 → 双指标 → 四行遥测 → 洞察 → ⌘K 条 → 底栏），刷新走插值不重播。
- **3D 轨道矩阵** —— 主环从 2D SVG 换成 three.js 场景，从外到内是一条完整的仪表带：**鳍片环**（84 根径向鳍片，高度按桶占比起伏，顶边按桶色发光，像频谱仪）→ **底轨**（暗金属 + 菲涅尔轮廓光）→ **刻度环**（72 格）→ **数据轨**（四色数据弧 + 一个跑动的读取头）→ **环心留空**。**图是 3D 的，数字与标签是普通 DOM 文字**——环心总览与环外百分比不随透视变形，环外标签随弧段实时投影定位。倾斜 30° 的视角 + 0.07 rad/s 空闲慢自转（约 90s 一圈）。
- **细节随尺寸自适应** —— 环的直径在 118–300px 之间，鳍片与刻度按画布大小换档（84 根 → 32 根、72 格 → 不画）。同一套细节在小环上会挤成一片噪点。
- **不烧帧** —— 入场与弧长插值满帧，空闲自转只跑 **20fps** 步进，面板不可见时整帧跳过（连场景更新都省掉）；整帧 22–30 次 draw call，不随时间增长。实测空闲 19 帧/秒、插值期间 36 帧/秒。
- **能降级** —— 拿不到 WebGL（虚拟机 / 远程桌面 / 禁硬件加速）、分片加载失败或建场失败，直接退回 2D SVG 环，功能一条不少，控制台留一条告警；运行中 `webglcontextlost` 立刻切回 SVG，上下文恢复后自动切回 3D。

**计划中**

- Top3 截断、日均 sparkline。
- 可配置的单价表（当前只有内置默认费率）。
- Alerts：按阈值告警（单日 token、单日花费等）。
- Copy JSON / Export CSV。

### Commands —— 全局命令面板

> 🚧 **开发中，尚未进主干。** 下面是目标形态。

一个可搜索的命令面板，`⌘K` / `Ctrl+K` 唤起，**与 Usage 同属一个扩展**——共用同一份本地状态与同一套配置。

- **搜索** —— 输入即过滤，支持命令别名。
- **分组** —— 最近 / 聊天 / 用量 / 系统。
- **可执行动作** —— 聚焦输入框、复制上一条回复、打开 Usage、切换时间窗（今日 / 7 日 / 30 日）、导出数据等。
- **键位克制** —— 多数命令**只在面板内执行**，不额外绑定全局键，避免和宿主快捷键打架；只有面板本身的唤出键是全局的。

### 两条取舍

- **数据不出本机。** 统计写在 DSH profile 下的本地 JSON，Client 经认证路由读回。没有遥测上报、没有账号、没有后端。
- **不重复造轮子。** token 计数直接复用 harness 自己的 `TokenUsageProjection` 四桶口径（`uncachedInputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens`，缺项按 0），与 Web「本轮用量」一致——不做第二套估算。

---

## 截图

### 真实运行效果

下面是**真实 DSH Web 宿主里跑出来的**面板（本地真实用量数据，主环为 3D 等高线层环）：

![DSH Web 宿主里的用量面板](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-3d-host.png)

| 宽面板 | 窄栏堆叠 |
|---|---|
| ![宽面板](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-3d-wide.png) | ![窄栏堆叠](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-3d-narrow.png) |

### v4 设计稿

![Usage 侧栏与命令面板](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v4-1280x720.png)

上图是 **v4 设计稿**：左侧 Usage 侧栏，右侧 ⌘K 命令面板。当前实现到左边的
Overview——环 + 缓存命中率 / 花费估算 + 四桶遥测 + 按来源 + 时间窗，外框与配色
跟设计稿一致（品牌头、平视网格底纹、唯一强调色电光蓝）。右半部分的命令面板，
以及左侧 Cost / Top / Alerts 三个标签页、底部导出动作，都还在开发中：
面板里它们以**禁用态**画着，形态留着但不点不动。

| 窄栏堆叠版 | 面板 hero 版 |
|---|---|
| ![窄栏堆叠版](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v4-360x800.png) | ![面板 hero 版](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v4-720x420.png) |

> 视觉稿源文件（SVG + 生成脚本）在 `design/_v4_src/`，本地工作区，不入库。
> 3D 环的动效基准（入场时间表、帧率预算、降级表）见 [design/motion-spec.md §2.3](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/design/motion-spec.md)。

---

## 安装

<!-- TODO(发布)：包发布前先占位，发布后核对下面的命令 -->

从 Git 装（开发 / 预览）：

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh plugin --profile web add github:<user>/dsh-usage-cmdkit
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

**唤出命令面板**：🚧 计划中 —— `⌘K` / `Ctrl+K`。

**刷新与清空**：面板上有「刷新」与「清空」。清空会删除本地统计记录，**不可撤销**。

---

## 配置与快捷键

<!-- TODO(配置)：下列项均未实现 -->

当前**没有任何配置项**。计划中：

| 配置 | 说明 | 状态 |
|------|------|------|
| `storagePath` | 统计文件路径（默认 DSH profile 下） | 🚧 计划中 |
| `retentionDays` | 保留天数（默认 30） | 🚧 计划中 |
| 单价表 | 花费估算用的 provider / model 单价 | 🚧 计划中（当前用内置常量） |
| 唤出键 | 命令面板快捷键，可改 | 🚧 计划中 |
| 冲突检测 | 唤出键与宿主快捷键冲突时提示 | 🚧 计划中 |

**快捷键冲突**：命令面板的唤出键是唯一绑到全局的键位，其余命令只在面板内执行，以避免和宿主快捷键冲突。改键后会做一次冲突检测（计划中）。

---

## 与 `dsh-kit` 等的区别

市面上同类插件不少，定位容易混。这里划清：

| | `dsh-usage-cmdkit` | 全家桶类（如 `dsh-kit`） |
|---|---|---|
| 范围 | 用量遥测 + 命令面板 | 页面终端、文件树、编辑器等一整套 |
| 数据 | 只读 harness 本地 token 记录 | 各模块自有数据源 |
| 状态 | 统计文件与配置全在本机 | 视模块而定 |
| 目标 | 把「花了多少、花在哪」和「一键做点什么」这两件事做扎实 | 覆盖广 |

一句话：**本项目不是页面终端 / 文件树全家桶**，专注用量 + 命令两件事。

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
  client/            浏览器半（右栏 Tab）
    index.ts         槽位注册、locale 命名空间、TAB_ID / TAB_KIND
    UsageDashboard.tsx / UsageRing.tsx / UsageTelemetry.tsx / UsageTitle.tsx
    UsageChrome.tsx  v4 外框件：底纹、品牌头、视图 Tab、时间窗、双指标、底栏
    UsageRing3D.tsx  3D 环宿主：canvas + DOM 读数覆盖层 + 降级到 SVG 环
    usage-3d.ts      three.js 场景：鳍片环、底轨、刻度、数据轨、读取头
    usage-ring-geometry.ts  2D / 3D 共用的分段与标签规则
    usage-motion.ts  入场编排的时间表与 Web Animations 原语
    usage-pricing.ts 费率表与成本 / 命中率算式
    usage-client.ts  取数与窗口状态
    usage-theme.ts   视觉常量
    locales.ts       zh 为键集事实来源，en 同键集
scripts/
  build-client.mjs   浏览器半 → lib/client.js（入口）+ lib/client.usage3d.js（3D 分片）
docs/                实施文档（00 统一说明 + 01/02/03 步骤文档）
design/              视觉稿（v4 成图已入库，源文件在 _v4_src/，本地）
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
pnpm run build:client   # → lib/client.js（入口）+ lib/client.usage3d.js（3D 分片）
```

> `pnpm run build` 也会在 `npm publish` 前自动跑（`prepublishOnly`）。
> 仓库根的 `pnpm-workspace.yaml` 放行了 esbuild 的构建脚本——它要靠 postinstall 落地平台二进制。

### 产物体积：3D 环是按需加载的

three.js **整包内联**进产物，但**不塞进首屏入口**：

| 产物 | 体积 | 什么时候拉 |
|------|------|-----------|
| `lib/client.js`（入口） | ≈34 KB | 面板打开即加载 |
| `lib/client.usage3d.js`（分片） | ≈568 KB | 面板需要 3D 环时才按需拉 |

宿主提供的 client 分片机制是 `require.async('./client.<名字>.js')`，分片文件名必须匹配
`client.<名字>.js`。**把 three 整包打进入口的话首屏会变成 574 KB**，所以这里拆成两个产物：
入口只留加载器与降级路径，分片拉不到就退回 2D SVG 环。

> `three` 与 `@types/three` 放在 **devDependencies**：运行时它已经被内联进产物，
> 不需要从 npm 装；放进 dependencies 反而会让宿主 profile 多装一份。

### 本地联调

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
- **不走官方 remotes。** `ctx.remote.<namespace>` 对第三方插件是关闭的（Client 侧是静态清单，第三方包加不进去）。改走 `ctx.connection.fetch.register`，在 Connection 的认证栅栏内注册精确路由，浏览器同源 `fetch` 直读。详见 [docs/03-remotes-and-client.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/03-remotes-and-client.md)。
- **全局标识取名规则**：`TAB_ID` 取包名（实现身份，全球唯一）；`TAB_KIND` 取短名 `usage-dashboard`（类型判别符，**不要改**——右栏已打开的 Tab 会把 kind 持久化，改名会让它们一律显示「这类内容还没有可用的查看方式」）；locale 命名空间 `dsh.usage`（全局声明合并点，撞名会让**对方的包**编译失败）。
- **样式走内联 style**，不走 CSS Modules——浏览器半是独立打包产物，不进 harness 的 CSS 管线。
- **3D 环的坑**（都踩过，记在这儿）：
  - **透明 + 双面材质会被画两遍**。three 默认对 `transparent: true` 且 `side: DoubleSide` 的材质先画背面再画正面，每次切换还置 `needsUpdate` → 每帧重编译着色器。开 `forceSinglePass: true` 后 draw call 从 51 降到 27，着色器编译从 2670/s 降到 267/s。
  - **环境贴图要自己转一次**。直接把等距柱状图丢给 `scene.environment`，three 每次取用都会重跑转换；先 `pmrem.fromEquirectangular()` 转好再赋值。
  - **别用连续发光管承载数据**。那是霓虹灯管，不是科幻仪表——真正的科幻 HUD 是大片暗的机械面 + 精密细线 + 极小的高能点缀。发光强度还要压在 1 附近：超过 1.5 会被 ACES 推成白，辉光糊成一团；辉光的形状交给可控的加法壳，bloom 只做微弱加成。
- **3D 与 SVG 必须同角度**。共享几何是「十二点方向起、顺时针铺开」，而 three 的 XY 平面 y 朝上、角度逆时针为正，3D 侧要做一次翻转（`局部角 = -共享角`）。不翻的话，拿不到 WebGL 退回 SVG 时构图是镜像的，画面会跳。
- **空闲只跑 20fps**。慢自转要看得见，但不值得烧 60fps（也是「禁 60FPS 刷屏」的硬要求）。帧率门槛放在**场景更新之前**，跳过的帧连场景更新都省掉。

### 文档

- [docs/README.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/README.md) —— 实施顺序与索引
- [docs/00-项目说明.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/00-项目说明.md) —— 项目总览与学习文档
- [docs/01-collect-usage-stats.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/01-collect-usage-stats.md) —— 步骤 1：采集 token 用量
- [docs/02-persist-stats.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/02-persist-stats.md) —— 步骤 2：持久化 JSON
- [docs/03-remotes-and-client.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/docs/03-remotes-and-client.md) —— 步骤 3：数据通道与 Client 半

### 外部参考

- [DSH 插件教程](https://dumplinghuman.github.io/dsh-plugin-tutorial/)（事件 / Cordis）
- [extension-cookbook.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/extension-cookbook.zh.md)（`session/event`）
- [API Gateway 参考](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/api-gateway.zh.md)（remote 通道的边界）
- [Whale Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（本地 JSON 思路，UI 不同）

---

## 迁移

本项目此前叫 **`dsh-usage-dashboard`**，当时只做用量面板。npm 上该名字已被他人占用（另一个「API 余额 + 今日花费」的侧栏小部件），因此更名为 **`dsh-usage-cmdkit`**，并把定位扩展成「用量遥测 + 命令面板」这一个扩展的两面。

改名**不影响任何已有安装**：本项目此前一直是 `private: true`，从未发布到 npm——npm 上的 `dsh-usage-dashboard` 是**别人的包**（另一个「API 余额 + 今日花费」的侧栏小部件），不要去动它。所以这里没有 npm 侧的迁移，只有两处本地变化：

- **目录名**：本地工作副本的文件夹可能还叫 `dsh-usage-dashboard`，克隆新仓库则是 `dsh-usage-cmdkit`；两者都能跑，按实际路径替换即可。
- **已积累的用量统计文件不受影响**——统计按 DSH profile 路径存放，与包名无关。

> 内部标识（Loader 行 id、Cordis 插件名、`TAB_ID`）已随包名一并加固，`TAB_KIND` 有意保持 `usage-dashboard` 不变，原因见「实现要点」。

---

## License

[MIT](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/LICENSE) —— 除非另有说明。
