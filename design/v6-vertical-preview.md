# 竖屏（360×800）预览说明 · DSH CmdKit v6

![竖屏 360×800 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v6-360x800.png)

> 成图：`design/dsh-cmdkit-v6-360x800.png`（360×800，2 倍图 720×1600）。
> 本文件说明这张图**是什么**、**怎么来的**、每一块对应实现的哪段代码，
> 以及与 `design/v6-visual-direction.md` 的**实现偏差**。
>
> 上一版见 [v5-vertical-preview.md](https://github.com/xiewg1987/dsh-usage-cmdkit/blob/main/design/v5-vertical-preview.md)。

## 这张图是真实组件渲染的

预览图不是另画的静态稿，而是把 `src/client/UsageCompact.tsx` 里的竖屏面板
**原样挂进浏览器**截出来的：

```
design/_v6_src/preview-360.tsx      # 预览入口：喂 30 日 mock 日序列 + en 字典
design/_v6_src/render-preview.mjs   # esbuild 打包 → Chrome(CDP) → 截图
node design/_v6_src/render-preview.mjs
```

渲染用 **CDP + 真实时钟**（导航后真的等 2.6 秒再截图）。
`chrome --headless --screenshot --virtual-time-budget=…` 截的是「入场前」——
Web Animations 的入场与 rAF 的数字滚动都不推进，数字会停在 0。

环境变量：

| 变量 | 作用 | 默认 |
|---|---|---|
| `PREVIEW_W` / `PREVIEW_H` | 画布尺寸（试矮侧栏用 `PREVIEW_H=700`） | 360 / 800 |
| `PREVIEW_SCALE` | 截图倍率 | 2 |
| `PREVIEW_OUT` | 输出路径 | `design/dsh-cmdkit-v6-360x800.png` |
| `PREVIEW_DEV=1` | 用 React 开发版渲染（报错带组件栈） | 关 |
| `PREVIEW_DUMP=1` | 导出**真实渲染出来的几何**到 `design/_v6_src/layout-360.json` | 关 |
| `PREVIEW_SVG=1` | 导出页面里真正画出的 **SVG**（折线 / 表盘 / 图标）到 `design/_v6_src/svg/` | 关 |

> `design/_v6_src/` 是本地工作区（不进版本库），与 `design/_v4_src/` 同理。

## 稿子与实现同源（不是各画一遍）

v6 起多了一条线：**Figma 里那帧是从实现导出来的**，不是照着成图手摆的。

```
node design/_v6_src/render-preview.mjs      # 出图
$env:PREVIEW_DUMP='1'; node design/_v6_src/render-preview.mjs   # 出几何表
$env:PREVIEW_SVG='1'; node design/_v6_src/render-preview.mjs    # 出 SVG
node design/_v6_src/make-figma-svg.mjs       # SVG 转 Figma 能吃的形式
```

- `layout-360.json` 里是每个元素的**盒子、字号、字重、颜色**（相对面板左上角）。
- `svg/` 里是页面里**真正画出来的** SVG：主折线、四条行内微折线、表盘环、Lucide 图标。
- Figma 帧 `v6 · 竖屏 360×800（实现对照）`（页 `v6 · 视觉方向与参考`，
  Section `63:3157`）就是拿这两份在 Figma 里搭出来的。

改实现 → 重跑脚本 → 几何与矢量照着更新。**设计稿与实现不会各走各的。**

两处手工调整（其余全自动）：

- **表盘**在 SVG 里是 `stroke-dasharray`，Figma 导入后会变成 4 段断弧，
  所以 Figma 侧改用原生弧形（`set_arc`，12 点钟起顺时针 36.5%）。
- **SVG 的 CSS `transform`**（表盘的 `rotate(-90deg)`）Figma 不认，
  `make-figma-svg.mjs` 把它烘焙成 SVG 的 `transform="rotate(-90 36 36)"`。

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
  30 日窗没有 60 天可比，就退成「后 15 天 vs 前 15 天」；
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

## 还没做的

- **宽面板（≥900px）仍是 3D 轨道矩阵双栏**：卡片 / 标签语言还没跟竖屏统一。
  v6 视觉方向只写了竖屏（360×800），宽面板这一轮**刻意不动**。
- **`IconGauge`（表盘图标）已定义但没使用**：表盘用 SVG 环画，图标留给别的场景。
