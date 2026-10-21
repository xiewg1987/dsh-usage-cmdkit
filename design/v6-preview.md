# v6 预览说明 · DSH CmdKit v6（竖屏 360×800 + 宽版 1280×720）

![竖屏 360×800 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-360x800.png)

![宽版 1280×720 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-1280x720.png)

> 成图：`design/dsh-cmdkit-v6-360x800.png`（360×800，2 倍图 720×1600）与
> `design/dsh-cmdkit-v6-1280x720.png`（1280×720，2 倍图 2560×1440）。
> 本文件说明这两张图**是什么**、**怎么来的**、每一块对应实现的哪段代码，
> 以及与 `design/v6-visual-direction.md` 的**实现偏差**。

## 这两张图是真实组件渲染的

预览图不是另画的静态稿，而是把面板组件**原样挂进浏览器**截出来的：

```
design/_v6_src/preview-360.tsx      # 竖屏入口：喂 30 日 mock 日序列 + en 字典
design/_v6_src/preview-1280.tsx     # 宽版入口：同一份 mock，宽版组件
design/_v6_src/mock.ts               # 两套预览共用的确定性 mock
design/_v6_src/render-preview.mjs    # esbuild 打包 → Chrome(CDP) → 截图
```

竖屏挂的是 `src/client/UsageCompact.tsx` 的 `UsageCompactView`，
宽版挂的是 `src/client/UsageWide.tsx` 的 `UsageWideView`——
**都是实现里的那一个组件**，不是另画一张图。

渲染用 **CDP + 真实时钟**（导航后真的等 2.6 秒再截图）。
`chrome --headless --screenshot --virtual-time-budget=…` 截的是「入场前」——
Web Animations 的入场与 rAF 的数字滚动都不推进，数字会停在 0。

环境变量：

| 变量 | 作用 | 默认 |
|---|---|---|
| `PREVIEW_ENTRY` | 入口：`preview-360` / `preview-1280` | `preview-360` |
| `PREVIEW_W` / `PREVIEW_H` | 画布尺寸（试矮侧栏用 `PREVIEW_H=700`） | 按入口（360×800 / 1280×720） |
| `PREVIEW_SCALE` | 截图倍率 | 2 |
| `PREVIEW_OUT` | 输出路径 | 按入口（`dsh-cmdkit-v6-<tag>.png`） |
| `PREVIEW_DEV=1` | 用 React 开发版渲染（报错带组件栈） | 关 |
| `PREVIEW_DUMP=1` | 导出**真实渲染出来的几何**到 `design/_v6_src/layout-<tag>.json` | 关 |
| `PREVIEW_SVG=1` | 导出页面里真正画出的 **SVG**（折线 / 表盘 / 图标）到 `design/_v6_src/svg-<tag>/` | 关 |
| `PREVIEW_RING=1` | 导出 3D 环的**透明底 PNG**到 `design/_v6_src/ring-3d-<tag>.png` | 关 |
| `PREVIEW_3D=1` | 强制走真 3D 环（宽版默认开） | 宽版开 |

> `design/_v6_src/` 是本地工作区（不进版本库），与 `design/_v4_src/` 同理。

## 稿子与实现同源（不是各画一遍）

v6 起多了一条线：**Figma 里那帧是从实现导出来的**，不是照着成图手摆的。

```
node design/_v6_src/render-preview.mjs                              # 出图
$env:PREVIEW_DUMP='1'; node design/_v6_src/render-preview.mjs       # 出几何表
$env:PREVIEW_SVG='1'; node design/_v6_src/render-preview.mjs        # 出 SVG
$env:PREVIEW_RING='1'; node design/_v6_src/render-preview.mjs      # 出 3D 环 PNG
node design/_v6_src/make-figma-svg.mjs 360                          # SVG 转 Figma 能吃的形式
node design/_v6_src/make-figma-frame.mjs 1280                       # 拼成整帧 SVG
```

- `layout-<tag>.json` 里是每个元素的**盒子、字号、字重、颜色、字距**（相对面板左上角）。
- `svg-<tag>/` 里是页面里**真正画出来的** SVG：主折线、四条行内微折线、表盘环、Lucide 图标。
- `make-figma-frame.mjs` 把几何表 + SVG 拼成**一份整帧 SVG**，Figma 那边一次 `import_svg` 就搭完。
- Figma 帧 `v6 · 竖屏 360×800（实现对照）` 与 `v6 · 宽版 1280×720（实现对照）`
  （页 `v6 · 视觉方向与参考`）就是拿这些搭出来的。

改实现 → 重跑脚本 → 几何与矢量照着更新。**设计稿与实现不会各走各的。**

三处手工调整（其余全自动）：

- **表盘**在 SVG 里是 `stroke-dasharray`，Figma 导入后会变成 4 段断弧，
  所以 Figma 侧改用原生弧形（`set_arc`，12 点钟起顺时针 36.5%）。
- **SVG 的 CSS `transform`**（表盘的 `rotate(-90deg)`）Figma 不认，
  `make-figma-svg.mjs` 把它烘焙成 SVG 的 `transform="rotate(-90 36 36)"`。
- **3D 环是位图**：3D 透视没法转成矢量，Figma 那边只能放 PNG（见宽版章节）。

---

# 竖屏（360×800）

## 版面构成（从上到下）

| 区块 | 内容 | 实现位置 |
|---|---|---|
| 品牌头 | `DSH CmdKit`（左 16px 700）+ `Usage`（右 9px 灰字） | `UsageChrome.tsx` `BrandHeader`（`size="compact"`） |
| 分隔线 | 发丝线 `rgba(255,255,255,.07)` | `UsageCompact.tsx` |
| 控件行 | `SegmentedControl`（暗底容器 + 选中浅药丸）+ 时间窗描边药丸（右对齐） | `UsageMeters.tsx` `SegmentedControl` / `UsageChrome.tsx` `WindowPills` |
| 主指标卡 | `742.6K` 42px + `TOKENS · 30D` + **涨跌签** `22.7% vs prev 15d` + **主折线** 124×24；右侧 **命中率表盘** 72px | `UsageCompact.tsx` + `UsageMeters.tsx` `Sparkline` / `MiniGauge` / `DeltaChip` |
| 指标块行 | 一张卡里两枚横排：`TODAY 28.6K` / `7 DAYS 201.8K`，中间一道发丝线，各自一条 4px 微条 | `UsageMeters.tsx` `StatTile` |
| 分类列表 | 四行 × 44：圆点 + 名称 + **行内微折线 44×12** + 绝对数 + 灰阶百分比 + 5px 细条；**行间发丝线** | `UsageTelemetry.tsx`（`variant="flat"`，`series` prop） |
| 洞察卡 | `ⓘ INSIGHT` 小标题 + 两行正文 + 右侧 64px 占比条 | `UsageChrome.tsx` `Insight variant="card"`（新增 `title` / `bar`） |
| 状态条 | 绿点 + `synced · local ok` + `· v0.1.0` + `Refresh / Clear` ghost 按钮（各带一枚 11px Lucide 图标，sticky 常驻） | `UsageChrome.tsx` `StatusFooter`（新增 `dot` / `version`） |

## 数据口径：折线与涨跌签从哪来

三处趋势元素都来自**宿主已有的日 rollup**，没有新开数据通路：

- `UsageSummary` 新增 `daily: UsageDailyPoint[]`（30 日，**从旧到新**，
  缺记录的日子**补零**——补零而不是跳过：跳过会把断档连成直线，
  看起来像「那几天用量平稳」，其实是「那几天没用」）。
- **主折线** = 30 日总量序列；**行内微折线** = 每桶自己的 30 日序列。
- **涨跌签** = 当前窗口的**日均** vs 前一个等长窗口的日均。
  30 日窗没有 60 日可比，就退成「后 15 天 vs 前 15 天」；
  **比不出来就不画**——空的标签比没有标签更让人分心。

## 视觉规矩

- **底色** `#070a12`（近黑的午夜蓝），**没有网格、没有角标、没有霓虹**。
- **强调色上限 2**：界面蓝青 `#38bdf8` + 涨跌绿 `#22c55e`（跌为 `#ef4444`，只在真有负值时出现）。
- **品类色**（蓝 / 绿 / 紫 / 橙）只出现在**圆点与细条**上，百分比一律灰阶。
- **图标取 Lucide**（ISC），路径原样搬进 `src/client/usage-icons.tsx`，
  Figma 里用同一份 SVG 导入——不手画、不加 npm 依赖。
  底栏两枚按钮也带图标（`refresh-cw` / `trash-2`，11px），
  但**不省掉文字**：清空是不可撤销的操作，光一个垃圾桶认不出会点到什么。
  图标让底栏按钮从 51.5 / 40.8px 宽涨到 66.5 / 55.8px（+15 = 图标 11 + 间隙 4），
  整组仍右对齐到 343px（面板右缘），左边界从 244.7 退到 214.7。
- **留白集中在下半段**：内容一屏装下（`contentHeight === clientHeight === 768`），
  洞察卡与底栏之间是刻意留的空。
- **底栏 sticky**：面板比视口高时状态条仍贴在可视区底部
  （`position: sticky` + 不透明底色），不用往下滚才看得见。

## 与 v6 方案的偏差（都已确认）

| 方案写的 | 实际做的 | 为什么 |
|---|---|---|
| stat 行 = 命中率 / 缓存读比 | stat 行 = **TODAY / 7 DAYS 总量** | 方案 §4 的环已经改成命中率；stat 再放命中率就是**同一件事说两遍**。环要表达**别处没有的量**，stat 改成两个时间尺度的总量。 |
| 控件行 32（一行放下） | 一行放下，但时间窗用**短档位** `TODAY / 7D / 30D` | 360 宽放不下长短两套标签（`TODAY / 7 DAYS / 30 DAYS` 与分段控件合计 ≈341px > 328px）。折成两行会把下面所有区块往下推 28px。 |
| 分类行「行间发丝线」 | 有（16px 高的发丝线带） | 发丝线占用行距，所以行高正好 44（16 行名 + 7 + 5 细条 + 16 发丝线带）。 |
| 品牌头右侧 `Usage` 9px 灰字 | 9px 灰字 | 蓝青让给选中态与进度环。 |
| 底栏 `dsh-usage-cmdkit · synced · local ok` + 版本号 | 窄栏**不重复包名**：`synced · local ok · v0.1.0` | 品牌头已经写着「DSH CmdKit」，再写一遍包名会把版本号挤成省略号。宽面板仍带包名。 |
| 方案合计 ≈660px + 间距，余 ~90px | 实际余 ≈45px | 控件行从「32」变「一行 29.5」省下的空间，被洞察卡（72→81）与四行发丝线带吃掉。**一屏仍然装得下**，留白略少于方案设想。 |

---

# 宽版（1280×720）

## 宽版为什么是独立组件

v6 视觉方向 §7 步骤 5 定了：**宽版仍是 3D 轨道矩阵，但卡片/标签语言要和竖屏统一**。
主视觉留 3D，其余全部换成竖屏那一套：分段控件、描边药丸、两枚 StatTile、
带微折线的分类列表、三层洞察卡、绿点底栏。

所以宽版不是「把竖屏拉宽」，而是**另一个组件**：`src/client/UsageWide.tsx` 的
`UsageWideView`。它与 `UsageCompactView` 同构（各自管自己的编排与 sticky 底栏），
`UsageDashboard.tsx` 只负责**量宽度、选布局、传参**。

共用件抽到两处，窄宽一起用：

- `usage-metrics.ts`：`dailyTotals` / `dailySeries` / `windowDelta` / `deltaLabel`
  —— 折线序列、涨跌签的算法各写一遍就会漂。
- `usage-buttons.ts`：`ghostButtonStyle(wide)` —— 预览与实现共用同一份按钮样式，
  否则成图里的按钮和真面板里的按钮会长得不一样。

## 版面构成

宽版是**两列**：左列 400px 宽，右列 672px 宽，中间 48px 间距，
整体 `maxWidth: 1120` 居中（面板 1280 − 左右各 30 内边距 = 1220，多出来的 100px 两边平分）。

| 区块 | 位置 | 内容 |
|---|---|---|
| 品牌头 | 31,23 | `DSH CmdKit` 16px 700 + 右侧 `USAGE` 9px 灰字；下方一道发丝线 |
| 控件行 | 31,88 | 左：`SegmentedControl`（`OVERVIEW / TOP / ALERTS`）；右：`WindowPills`（`TODAY / 7 DAYS / 30 DAYS`，选中项蓝青描边 + 12% 底） |
| 主指标卡（左列） | 80,137.5 · 400×376 | **3D 环 259×259**（居中，环心是 `742.6K` + `TOKENS · 30 DAYS` + `DAILY AVG 24.8K`）+ 涨跌签 `22.7% vs prev 15d` + 30 日主折线 366×26 |
| 洞察卡（左列） | 80,533.5 · 400×81.3 | `ⓘ INSIGHT` + 两行正文 + 右侧 64px 占比条 |
| 指标块行（右列） | 528,137.5 · 672×75.5 | 一张卡里两枚横排 `TODAY 28.6K` / `7 DAYS 201.8K`，中间一道发丝线，各自一条 4px 微条 |
| 分类列表（右列） | 528,233 · 672×247 | 四行：圆点 + 名称 + 行内微折线 44×12 + 绝对数 + 灰阶百分比 + 5px 细条；行间发丝线 |
| 来源卡（右列） | 528,500 · 672×115.5 | `BY SOURCE` + 三行 `deepseek / chat` 等 |
| 状态条 | 31,650.5 · 1218×44.5 | 绿点 + `dsh-usage-cmdkit · synced · local ok` + `· v0.1.0` + `Refresh / Clear` ghost 按钮（各带 11px Lucide 图标），**sticky 常驻** |

分类列表与竖屏是同一套列表语言，行内微折线、细条、行间发丝线都一样，
只有字号放大一档（行名 13px / 竖屏 11px）——宽版有横向余量。

## 环的大小是量出来的，不是定出来的

面板是右栏，宿主给的高度随窗口变：1080p 的浏览器大约 950，笔记本 750 上下，
窄窗全屏时更少。**固定尺寸的设计稿定不了这件事**。

所以 `UsageWideView` 里有一层 `squeeze`：

- 环的基准直径 = `clamp(220, 300, 左列宽 − 100)`（左列 400 → 300）；
- 内容比一屏高多少，就把环压小多少，压到 `ringFloor`（190）为止；
- **只压不放**：压过头了下一次量到有余量再放回去，容易来回抖。

1280×720 这一稿量出来是 **41px 的溢出 → 环压到 259**，
内容高度与可视高度正好相等（`contentHeight === clientHeight === 672`）。

## 3D 环在 Figma 里是位图

3D 透视没法转成矢量，Figma 那边只能放 PNG。但**文字必须还是可编辑的文本节点**——
环心的总数与环外的百分比标签都是 DOM 覆盖层，不在 canvas 里。

所以 `PREVIEW_RING=1` 单独把 canvas 那一层抠成**透明底 PNG**
（`ring-3d-1280.png`，518×518，落在 150.5,164.5，CSS 尺寸 259×259）：

- 取法是把 `canvas.toDataURL()` 挂进 `requestAnimationFrame`——
  排在 three 的渲染回调之后、浏览器合成之前，拿到的就是刚画完的那一帧
  （`preserveDrawingBuffer` 没开，晚一帧读回来就是空的）。
- 透明底靠 three 的 `alpha: true`；脚本还会拿角落像素的 alpha 探针自检。

Figma 里这张图放在**卡片之上、环心文字之下**——所以要把它插到整帧 SVG 的
第 17 个图层位置，不是放在最上层。

## 视觉规矩（与竖屏同源）

- 底色 `#070a12`，卡片 `rgba(255,255,255,.035)`，描边 `rgba(255,255,255,.06)`。
- 强调色**只有蓝青** `#38bdf8`；涨跌绿 `#22c55e` 只用在涨跌签与 7 日微条上。
- **没有网格、没有角标、没有发光规则线**——v5 那版宽面板满屏网格，这一版删干净了。
- 图标、字号刻度、卡片语言全部沿用竖屏那套（Lucide 图标 + Inter / JetBrains Mono）。

---

## 还没做的

- **`IconGauge`（表盘图标）已定义但没使用**：表盘用 SVG 环画，图标留给别的场景。
- **Figma 变量与组件还没建**：v6 视觉方向 §7 步骤 2、3 说要先建变量与 9 个组件，
  实际是把**实现导出的几何**一次性搭成帧——稿子与实现同源已经达成，
  但「可复用组件」这件事还没做。
- **`TOP` / `ALERTS` 两个视图仍是占位**：分段控件只切选中态。
