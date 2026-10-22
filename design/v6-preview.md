# v6 预览说明 · DSH Meters v6（竖屏 360×800 三屏 + 宽版 1280×720）

![竖屏 360×800 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-meters/main/design/dsh-meters-v6-360x800.png)

![Top 屏 360×800 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-meters/main/design/dsh-meters-v6-top-360x800.png)

![告警屏 360×800 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-meters/main/design/dsh-meters-v6-alerts-360x800.png)

![Loading 骨架态 360×800 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-meters/main/design/dsh-meters-v6-loading-360x800.png)

![宽版 1280×720 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-meters/main/design/dsh-meters-v6-1280x720.png)

![宽版 Top 屏 1280×768 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-meters/main/design/dsh-meters-v6-top-1280x768.png)

![宽版告警屏 1280×960 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-meters/main/design/dsh-meters-v6-alerts-1280x960.png)

> 成图：`design/dsh-meters-v6-360x800.png`（总览，360×800，2 倍图 720×1600）、
> `design/dsh-meters-v6-top-360x800.png`、`design/dsh-meters-v6-alerts-360x800.png`、
> `design/dsh-meters-v6-loading-360x800.png`（Loading 骨架态），
> 与 `design/dsh-meters-v6-1280x720.png`（宽版总览，2 倍图 2560×1440）、
> `design/dsh-meters-v6-top-1280x768.png`（宽版 Top）、
> `design/dsh-meters-v6-alerts-1280x960.png`（宽版告警）。
> 宽版 Top 的内容高度 720px、告警 912px，720 装不下，
> 所以那两稿按实际高度出 1280×768 与 1280×960。
> 本文件说明这些图**是什么**、**怎么来的**、每一块对应实现的哪段代码，
> 以及与 `design/v6-visual-direction.md` 的**实现偏差**。

## 这几张图是真实组件渲染的

预览图不是另画的静态稿，而是把面板组件**原样挂进浏览器**截出来的：

```
design/_v6_src/preview-shared.tsx     # 竖屏四张预览共用的挂载（数据 + 文案 + 动作）
design/_v6_src/preview-360.tsx        # 竖屏入口：总览
design/_v6_src/preview-360-top.tsx    # 竖屏入口：Top
design/_v6_src/preview-360-alerts.tsx # 竖屏入口：告警
design/_v6_src/preview-360-loading.tsx# 竖屏入口：Loading 骨架态
design/_v6_src/preview-1280.tsx       # 宽版入口：同一份 mock，宽版组件
design/_v6_src/preview-1280-top.tsx   # 宽版入口：Top
design/_v6_src/preview-1280-alerts.tsx# 宽版入口：告警
design/_v6_src/mock.ts                # 几套预览共用的确定性 mock
design/_v6_src/render-preview.mjs     # esbuild 打包 → Chrome(CDP) → 截图
```

竖屏挂的是 `src/client/views/UsageCompact.tsx` 的 `UsageCompactView`，
宽版挂的是 `src/client/views/UsageWide.tsx` 的 `UsageWideView`——
**都是实现里的那一个组件**，不是另画一张图。
竖屏四张只差「哪个视图」与「是不是在读数」，其余（数据、字典、按钮）共用一份，
差一样就分不清预览变的是设计还是数据。

渲染用 **CDP + 真实时钟**（导航后真的等 2.6 秒再截图）。
`chrome --headless --screenshot --virtual-time-budget=…` 截的是「入场前」——
Web Animations 的入场与 rAF 的数字滚动都不推进，数字会停在 0。

环境变量：

| 变量 | 作用 | 默认 |
|---|---|---|
| `PREVIEW_ENTRY` | 入口：`preview-360` / `preview-360-top` / `preview-360-alerts` / `preview-360-loading` / `preview-1280` / `preview-1280-top` / `preview-1280-alerts` | `preview-360` |
| `PREVIEW_W` / `PREVIEW_H` | 画布尺寸（试矮侧栏用 `PREVIEW_H=700`；宽版 Top / 告警入口的 tag 落在画布表外，**要自己给尺寸**） | 按入口（360×800 / 1280×720） |
| `PREVIEW_SCALE` | 截图倍率 | 2 |
| `PREVIEW_OUT` | 输出路径 | 按入口（`dsh-meters-v6-<tag>.png`） |
| `PREVIEW_DEV=1` | 用 React 开发版渲染（报错带组件栈） | 关 |
| `PREVIEW_DUMP=1` | 导出**真实渲染出来的几何**到 `design/_v6_src/layout-<tag>.json` | 关 |
| `PREVIEW_SVG=1` | 导出页面里真正画出的 **SVG**（折线 / 表盘 / 图标）到 `design/_v6_src/svg-<tag>/` | 关 |

出另外三张竖屏图：

```bash
$env:PREVIEW_ENTRY='preview-360-top';    $env:PREVIEW_OUT='design/dsh-meters-v6-top-360x800.png';     node design/_v6_src/render-preview.mjs
$env:PREVIEW_ENTRY='preview-360-alerts'; $env:PREVIEW_OUT='design/dsh-meters-v6-alerts-360x800.png';  node design/_v6_src/render-preview.mjs
$env:PREVIEW_ENTRY='preview-360-loading';$env:PREVIEW_OUT='design/dsh-meters-v6-loading-360x800.png'; node design/_v6_src/render-preview.mjs
```

宽版 Top / 告警两屏：这两个入口的 tag（`1280-top` / `1280-alerts`）不在画布表里，
**必须显式给 `PREVIEW_W` / `PREVIEW_H`**，否则会退回 360×800：

```bash
$env:PREVIEW_W='1280'; $env:PREVIEW_H='768'
$env:PREVIEW_ENTRY='preview-1280-top';   $env:PREVIEW_OUT='design/dsh-meters-v6-top-1280x768.png';   node design/_v6_src/render-preview.mjs
$env:PREVIEW_W='1280'; $env:PREVIEW_H='960'
$env:PREVIEW_ENTRY='preview-1280-alerts';$env:PREVIEW_OUT='design/dsh-meters-v6-alerts-1280x960.png'; node design/_v6_src/render-preview.mjs
```

> `design/_v6_src/` 是本地工作区（不进版本库），与 `design/_v4_src/` 同理。

## 稿子与实现同源（不是各画一遍）

v6 起多了一条线：**Figma 里那帧是从实现导出来的**，不是照着成图手摆的。

```
node design/_v6_src/render-preview.mjs                              # 出图
$env:PREVIEW_DUMP='1'; node design/_v6_src/render-preview.mjs       # 出几何表
$env:PREVIEW_SVG='1'; node design/_v6_src/render-preview.mjs        # 出 SVG
node design/_v6_src/make-figma-svg.mjs 360                          # SVG 转 Figma 能吃的形式
node design/_v6_src/make-figma-frame.mjs 1280                       # 拼成整帧 SVG
```

- `layout-<tag>.json` 里是每个元素的**盒子、字号、字重、颜色、字距**（相对面板左上角）。
- `svg-<tag>/` 里是页面里**真正画出来的** SVG：主折线、四条行内微折线、表盘环、Lucide 图标。
- `make-figma-frame.mjs` 把几何表 + SVG 拼成**一份整帧 SVG**，Figma 那边一次 `import_svg` 就搭完。
- Figma 帧 `v6 · 竖屏 360×800（实现对照）` 与 `v6 · 宽版 1280×720（实现对照）`
  （页 `v6 · 视觉方向与参考`）就是拿这些搭出来的。

改实现 → 重跑脚本 → 几何与矢量照着更新。**设计稿与实现不会各走各的。**

两处手工调整（其余全自动）：

- **表盘**在 SVG 里是 `stroke-dasharray`，Figma 导入后会变成 4 段断弧，
  所以 Figma 侧改用原生弧形（`set_arc`，12 点钟起顺时针 36.5%）。
- **SVG 的 CSS `transform`**（表盘的 `rotate(-90deg)`）Figma 不认，
  `make-figma-svg.mjs` 把它烘焙成 SVG 的 `transform="rotate(-90 36 36)"`。

## ArtCraft 稿也走同一条线（原生节点，不是整帧贴图）

本地设计工具（ArtCraft / FigCraft）里的稿子 `DSH Meters · Usage 360×800 (MCP)`
也走「从实现导出 → 脚本建原生节点」这条路，**不是照着成图手摆的**。

**为什么不整帧 `import_svg`**：整帧 SVG 导入会把所有文字变成矢量路径——
看着一样，但一个字都改不了，再也不知道稿子里哪块是什么。
所以走**原生节点**：文字仍是文字，图层带语义名（`CK/Card/BYMODEL`、`CK/Text/Share7DPT`…）。

三个脚本各管一段：

```
design/_v6_src/render-preview.mjs        # 出图 + 导几何表 + 导 SVG
design/_v6_src/make-artcraft-nodes.mjs   # 几何表 → MCP 建节点指令
design/_v6_src/apply-artcraft.mjs        # 指令 → FigCraft MCP → 画布
design/_v6_src/figcraft-mcp-call.mjs     # FigCraft MCP 的最小 stdio 客户端
```

跑一遍：

```powershell
$env:PREVIEW_ENTRY='preview-360-top'; $env:PREVIEW_DUMP='1'; $env:PREVIEW_SVG='1'
node design/_v6_src/render-preview.mjs
node design/_v6_src/make-artcraft-nodes.mjs 360-top design/_v6_src/artcraft-360-top.json
$env:FIGCRAFT_STAGE_X='2500'
node design/_v6_src/apply-artcraft.mjs 360-top "CK/Screen/Top"      # ��在空白处
node design/_v6_src/apply-artcraft.mjs list                          # 看现有屏与 id
node design/_v6_src/apply-artcraft.mjs swap <新id> <旧id> <x> <名字> # 核对过再换上
```

**先建在空白处、核对过再换上**：新屏与旧屏并存，截图比对没问题了才删旧屏搬新屏，
中途任何一步出错都不会出现「一屏都没有」的空档。

几条踩过的坑（都在脚本里写清了原因）：

- **元素盒子 ≠ 文字盒**。环里那个百分比，元素盒是 104×104 的整个环，
  照抄元素盒数字就跑到角上了。所以导几何时用 Range 量**文字自己的盒**（`tx`/`ty`）。
- **FigCraft 的矩形装不了图层**。进度条的「槽」里有填充条，槽就得是 frame；
  纯色块才是矩形。判错会报 `can't contain layers`。
- **文本节点装不了图层**。实现里 `<span>TOP CONSUMERS · <span>30D</span></span>`
  那种一行套一段的，子 span 要提到父层，自己成为平级的文本节点。
- **右对齐的数字要用元素盒**（不是文字盒）——要的是**右边缘**对齐，
  用文字盒的话框的右缘会推到文字右边，数字反而被卡片裁掉半截。
- **MCP 的 `run_command` 传数组参数会被序列化坏**（`ids: [3]` → `{"item":3}`），
  删除得先 `select` 再调不带 `ids` 的命令；而且 `edit.delete` 走选区时**多选也不灵**，一次删一个。
- **attach 跟着「当前活动标签页」走**。用户切到别的文档，脚本就会把稿子建到那份文档里。
  所以脚本自己先找目标文档，找不到就停——宁可不做，也不能建错地方。

---

# 竖屏（360×800）

## 三屏 + 一态骨架

竖屏不是一个页面，是**三屏**（总览 / Top / 告警）外加**一态骨架**（读数中）。
三屏换的是身体，头（`UsageHeader`）永远一样：

```
UsageHeader = 品牌行 + 发丝线 + 控件行（视图分段 + 时间窗药丸）
  ├─ overview  总览   大数 + 命中率环 → 指标块 → 四行遥测 → 洞察
  ├─ top       Top    头部份额环 + 三枚指标块 → BY MODEL（带命中列）→ 模型走向
  └─ alerts    告警   条数与分级 → 最近清单 → 每日总量趋势（末尾挂一行节律）
loading = true 时，身体换成骨架（UsageSkeleton），头与底栏照旧
```

| 屏 | 关键读数 | 实现位置 |
|---|---|---|
| 总览 | `742.6K` + 命中率环 36.5% + TODAY/7 DAYS + 四行遥测 + 洞察 | `UsageCompact.tsx` |
| Top | `TOP SHARE 53.9%`（头部模型占窗口总量）+ PER MODEL / PEAK DAY / CACHE HIT + 模型排行（**多一列「命中」**）+ 模型走向（微折线 + 份额变化） | `UsageTopView.tsx` |
| 告警 | 条数与 HIGH/MED/LOW 分级 + 每条告警的说明与量级条 + 每日总量趋势卡，**趋势卡末尾一行节律** | `UsageAlertsView.tsx` |
| 骨架 | 块（白 5%）与条（白 15%）的轮廓，随视图变形态 | `UsageSkeleton.tsx` |
| 骨架 | 块（白 5%）与条（白 15%）的轮廓，随视图变形态 | `UsageSkeleton.tsx` |

告警的**数字全是推出来的**（`usage-alerts.ts`）：峰值日与日均的比、
各桶 7 日涨幅、输出增速与总量的差。阈值集中在 `THRESHOLD`，
不满足就不报——「这段时间没有异常用量」是合法结论。

## 版面构成（从上到下，总览屏）

| 区块 | 内容 | 实现位置 |
|---|---|---|
| 品牌头 | `DSH Meters`（左 16px 700）+ `Usage`（右 9px 灰字） | `UsageChrome.tsx` `BrandHeader`（`size="compact"`） |
| 分隔线 | 发丝线 `rgba(255,255,255,.07)` | `UsageHeader.tsx` |
| 控件行 | `SegmentedControl`（暗底容器 + 选中**描边**药丸）+ 时间窗描边药丸（右对齐） | `UsageMeters.tsx` `SegmentedControl` / `UsageChrome.tsx` `WindowPills` |
| 主指标卡 | `742.6K` 42px + `TOKENS · 30D` + **涨跌签** `22.7% vs prev 15d` + **主折线** 124×24；右侧 **命中率表盘** 104px | `UsageCompact.tsx` + `UsageMeters.tsx` `Sparkline` / `MiniGauge` / `DeltaChip` |
| 指标块行 | 一张卡里两枚横排：`TODAY 28.6K` / `7 DAYS 201.8K`，中间一道发丝线，各自一条 4px 微条 | `UsageMeters.tsx` `StatTile` |
| 分类列表 | 四行 × 44：圆点 + 名称 + **行内微折线 44×12** + 绝对数 + 灰阶百分比 + 5px 细条；**行间发丝线** | `UsageTelemetry.tsx`（`variant="flat"`，`palette="ramp"`，`series` prop） |
| 洞察卡 | `💡 INSIGHT` 小标题 + 两行正文 + 右侧 64px 占比条 | `UsageChrome.tsx` `Insight`（`title` / `bar`） |
| 状态条 | 绿点 + `synced · local ok` + `· v0.1.0` + `Refresh / Clear` ghost 按钮（各带一枚 11px Lucide 图标，sticky 常驻） | `UsageChrome.tsx` `StatusFooter`（`dot` / `version`） |

## 数据口径：折线与涨跌签从哪来

三处趋势元素都来自**宿主已有的日 rollup**，没有新开数据通路：

- `UsageSummary` 新增 `daily: UsageDailyPoint[]`（30 日，**从旧到新**，
  缺记录的日子**补零**——补零而不是跳过：跳过会把断档连成直线，
  看起来像「那几天用量平稳」，其实是「那几天没用」）。
- **主折线** = 30 日总量序列；**行内微折线** = 每桶自己的 30 日序列。
- **涨跌签** = 当前窗口的**日均** vs 前一个等长窗口的日均。
  30 日窗没有 60 日可比，就退成「后 15 天 vs 前 15 天」；
  **比不出来就不画**——空的标签比没有标签更让人分心。

## 两组新统计：分模型命中率与节律

### 分模型命中率（Top 屏）

全局命中率是**加权平均**：量大的模型说了算。但真正该关心的是「量跑在哪儿」——
一个只占 5% 的模型命中再低也无所谓，扛着 30% 的量却命中最低，它才是该修的那一个。

`UsageSummary.byProvider` 的每一项**本来就带着完整四桶**，所以这组数字
不用新开数据通路，`usage-metrics.ts` 的 `modelHitRates()` 派生即可：

| 模型 | 用量 | 占比 | 命中率 |
|---|---|---|---|
| deepseek / chat | 400,200 | 53.9% | 39.3% |
| deepseek / reasoner | 223,000 | 30.0% | **29.8%** |
| openai / gpt-5 | 119,408 | 16.1% | 40.4% |

- **竖屏**：并进 BY MODEL 排行做一列（`layout="compact"`），
  上方一句洞察点名「扛着 30% 的量、命中只有 29.8%」的那个模型。
- **宽版**：独立成一张 CACHE HIT 卡，每行一条命中条，**条上压一根全局命中率的竖线**，
  直接看出谁在线的下面。

### 节律（告警屏）

`usage-rhythm.ts` 的 `deriveRhythm()` 从 30 日序列推三组形状数字：

- **周末 / 工作日**：两边的日均之比（mock 里周末是工作日的 62%）；
- **连续活跃**：从末尾往回数连着用了几天，另有几天完全没动；
- **峰谷比**：峰值 ÷ 中位数（1.35×），另给变异系数（23.4%）。

峰谷比用**中位数**而不是平均数：平均数会被峰值自己拉高，拿它当分母算出来的比值偏小。

- **竖屏**：挤进「每日总量」卡末尾一行（`variant="strip"`）——这张卡讲的就是形状。
- **宽版**：独立成一张 RHYTHM 卡，三枚指标块（`variant="card"`）。

### 为什么窄屏是「塞进去」、宽版是「独立成卡」

360×800 的竖屏**一屏只装得下这么多**：总览屏的余量只有 30px，
顶部分段 + 三屏 + 骨架已经是上限。所以新统计在窄屏是**挤进已有的卡**，
在宽版是**独立成卡**——信息一样，密度不同。
这跟 `UsageTelemetry` 的 `flat` / `wide` 是同一个做法。

三屏的成图高度都核对过：`contentHeight === clientHeight === 768`，一屏装得下，不切不裁。

### 顺带修掉的排序口径

`byProvider` 以前按 `未缓存输入 + 输出` 排序，但排行行里显示的量、
TOP SHARE 环里算的占比，**都是四桶之和**。排序依据和显示值不是一回事：
缓存命中极高的模型会被排到后面，环里算出来的却不是它。
现已统一成四桶排序（`usage-store.ts` 的 `bucketTotal`）。

## 第三组统计：模型走向（Top 屏）

`byProvider` 只给 30 日**合计**——看不出这个模型是在涨还是在退。
但**数据本来就在盘上**：`DayRollup.byProvider` 每天每模型都存了四桶，
只是 `summarize()` 把它压成了一份累计。

于是协议加了一个字段（`src/protocol.ts`）：

```ts
dailyByProvider: UsageProviderDaily[]   // 每个 provider/model 的 30 日四桶
```

- **不迁数据、不改文件格式**：宿主只是把已有的日 rollup 按模型摊开。
- 顺序与 `byProvider` 一一对应（同一个模型在同一位置），
  否则「排行第 2 的模型」和「日序列第 2 条」会错位。
- 缺记录的日子补零，与全局日序列同一套规矩。

客户端据此算出**份额变化**（`usage-metrics.ts` 的 `modelShareShift`）：
近 7 日的份额 vs 前 7 日的份额，差多少个百分点。

份额是**相对**的——一个模型涨份额，别的必然让出；
而且总量同时在涨的模型，份额变化会被稀释，
那不是「它在退」而是「大家都在涨」。两个数摆在一起才看得出来。

mock 里的故事：gpt-5 抢份额（+3.1pt），reasoner 让份额（-1.8pt）。

- **窄屏**：一张「模型走向」卡，每行 = 名称 + 30 日微折线 + 份额变化。
- **宽版**：同一张卡，折线画宽一倍（96px），四张卡并成两列两行。

**窄屏拿「按来源」卡换了位置**：那张卡的两行是模型行按 provider 求和的结果，
模型名里本来就带着 provider，信息是重复的；模型走向是**新的一维**，位置给它更值。
宽版放得下，两张都留。

## 视觉规矩

- **底色** `#070a12`（近黑的午夜蓝），**没有网格、没有角标、没有霓虹**。
- **竖屏整屏一种彩色**：界面蓝青 `#38bdf8`；四个桶用**同一色相的四档亮度**
  （`BUCKET_RAMP`），涨跌签 / 指标条 / 洞察条也走蓝青。
  宽版另算：主环是四段桶色弧，列表用四色玻璃（`palette="glass"`）。
- **品类色只标注数据，不参与排版**：圆点、微折线、细条同一色，百分比一律灰阶。
- **选中 = 描边**：视图分段与时间窗药丸都用描边，容器暗底。
- **图标取 Lucide**（ISC），路径原样搬进 `src/client/components/usage-icons.tsx`，
  Figma 里用同一份 SVG 导入——不手画、不加 npm 依赖。
  底栏两枚按钮也带图标（`refresh-cw` / `trash-2`，11px），
  但**不省掉文字**：清空是不可撤销的操作，光一个垃圾桶认不出会点到什么。
  图标让底栏按钮从 51.5 / 40.8px 宽涨到 66.5 / 55.8px（+15 = 图标 11 + 间隙 4），
  整组仍右对齐到 343px（面板右缘），左边界从 244.7 退到 214.7。
- **骨架两档灰度**：块白 5% / 条白 15%。
  条必须比块亮一档——骨架的信息量全在「条在不在」上；
  同亮度时整屏糊成灰板，缩略图上读不出「在加载」。
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
| 底栏 `dsh-usage-meters · synced · local ok` + 版本号 | 窄栏**不重复包名**：`synced · local ok · v0.1.0` | 品牌头已经写着「DSH Meters」，再写一遍包名会把版本号挤成省略号。宽面板仍带包名。 |
| 方案合计 ≈660px + 间距，余 ~90px | 实际余 ≈45px | 控件行从「32」变「一行 29.5」省下的空间，被洞察卡（72→81）与四行发丝线带吃掉。**一屏仍然装得下**，留白略少于方案设想。 |
| 一屏（总览） | **三屏 + 一态骨架** | 顶部分段控件原本是占位（除第一个全被 `disabled`）。这一轮把它接上真开关，另做 Top 与告警两屏；读数时身体换成骨架。 |
| 品类色：四色（蓝/绿/紫/橙） | 竖屏**单色梯队**（同一色相四档亮度） | 四种色相并排会把四行读成四件事，它们其实是同一份用量的四个切面。宽版列表仍是四色玻璃——它的主环本来就是四段桶色弧。 |
| 命中率表盘 72px | **104px** | 表盘是竖屏唯一表达「别处没有的量」的地方（命中率），小到 72 读起来只是个装饰圈。104 占内容区 35%，落在 28–36% 的区间里。 |
| 洞察卡图标 ⓘ | **灯泡**（Lucide `lightbulb`） | 洞察说的是「这件事说明了什么」，ⓘ 只能表示「这里有说明」。 |
| 涨跌签用涨跌绿/红 | 竖屏走**界面蓝青** | 竖屏整屏只留一种彩色；方向仍由箭头与正负号说明。宽版不动（涨跌绿/红仍在）。 |
| （本轮新增）分组命中率 | 竖屏**并进 BY MODEL 做一列**，宽版**独立成 CACHE HIT 卡** | 360 宽的竖屏一屏只装得下这么多（总览余量仅 30px），新统计挤进已有的卡；宽版空间富余，独立成卡。信息一样，密度不同。 |
| （本轮新增）节律三件套 | 竖屏挤进「每日总量」卡末尾一行，宽版**独立成 RHYTHM 卡** | 同上。节律讲的是「形状」，跟每日总量是同一件事的两种说法，所以竖屏挂在那张卡里。 |
| （本轮新增）模型走向 | 竖屏**用模型走向换掉按来源卡**，宽版两张都留 | 竖屏一屏只装得下两张卡。按来源那两行是模型行按 provider 求和的结果（模型名里本来就带着 provider），信息是重复的；模型走向是新的一维。 |

---

# 宽版（1280×720）

宽版与竖屏一样是**三屏**（总览 / Top / 告警），共用 `UsageHeader`。
成图有三张：总览 `dsh-meters-v6-1280x720.png`、Top `dsh-meters-v6-top-1280x768.png`、
告警 `dsh-meters-v6-alerts-1280x960.png`（这一屏内容 912px，按实际高度出图）。

宽版 Top / 告警是**单列的卡流**（跟竖屏同一套组件），宽版靠卡片自己换行：
窄列叠一列，宽列并两三列。宽版放得下，**新统计就独立成卡**：
Top 屏多一张 CACHE HIT 卡和一张 MODEL TREND 卡，告警屏多一张 RHYTHM 卡。

## 宽版为什么是独立组件

宽版的主视觉换成了**大号扁平环**（不再是 3D 轨道矩阵），其余全部是竖屏那一套：
分段控件、描边药丸、两枚 StatTile、带微折线的分类列表、三层洞察卡、绿点底栏。

所以宽版不是「把竖屏拉宽」，而是**另一个组件**：`src/client/views/UsageWide.tsx` 的
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
| 品牌头 | 31,23 | `DSH Meters` 16px 700 + 右侧 `USAGE` 9px 灰字；下方一道发丝线 |
| 控件行 | 31,88 | 左：`SegmentedControl`（`OVERVIEW / TOP / ALERTS`）；右：`WindowPills`（`TODAY / 7 DAYS / 30 DAYS`，选中项蓝青描边 + 12% 底） |
| 主指标卡（左列） | 80,137.5 · 400×376 | **扁平环 259×259**（四段桶色弧、**无外发光**；环外百分比走灰阶；环心是 `742.6K` + `TOKENS · 30 DAYS` + `DAILY AVG 24.8K`）+ 涨跌签 `22.7% vs prev 15d` + 30 日主折线 366×26 |
| 洞察卡（左列） | 80,533.5 · 400×81.3 | `ⓘ INSIGHT` + 两行正文 + 右侧 64px 占比条 |
| 指标块行（右列） | 528,137.5 · 672×75.5 | 一张卡里两枚横排 `TODAY 28.6K` / `7 DAYS 201.8K`，中间一道发丝线，各自一条 4px 微条 |
| 分类列表（右列） | 528,233 · 672×247 | 四行：圆点 + 名称 + 行内微折线 44×12 + 绝对数 + 灰阶百分比 + 5px 细条；行间发丝线 |
| 来源卡（右列） | 528,500 · 672×115.5 | `BY SOURCE` + 三行 `deepseek / chat` 等 |
| 状态条 | 31,650.5 · 1218×44.5 | 绿点 + `dsh-usage-meters · synced · local ok` + `· v0.1.0` + `Refresh / Clear` ghost 按钮（各带 11px Lucide 图标），**sticky 常驻** |

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

## 扁平环在 Figma 里是矢量

环是纯 SVG，所以 `PREVIEW_SVG=1` 直接把那一整个 `<svg>` 导出来
（`svg-1280/ring-main.svg`，259×259），跟着整帧 SVG 一次 `import_svg` 就进去了。

不用位图，也不用单独插图层——这是拿掉 3D 之后最直接的好处：
**稿子里的每一个元素都是矢量，文字也还是可编辑的文本节点。**

## 视觉规矩（与竖屏同源）

- 底色 `#070a12`，卡片 `rgba(255,255,255,.035)`，描边 `rgba(255,255,255,.06)`。
- 强调色**只有蓝青** `#38bdf8`；涨跌绿 `#22c55e` 只用在涨跌签与 7 日微条上。
- **没有网格、没有角标、没有发光规则线**——v5 那版宽面板满屏网格，这一版删干净了。
- 主环**只留色、不留光**：四段桶色弧（蓝→绿→紫→橙）是 v6 令牌允许的位置，
  但弧上没有外发光、环心没有能量核，环外百分比是灰阶。
  依据见 `design/v6-visual-direction.md` §6 与 §9.5。
- 图标、字号刻度、卡片语言全部沿用竖屏那套（Lucide 图标 + Inter / JetBrains Mono）。

---

## 还没做的

- **ArtCraft 稿已经跟上了**：`DSH Meters · Usage 360×800 (MCP)` 里的六屏
  （总览 / Top / 告警 + 三屏骨架）都按**实现导出的几何**重搭过一遍，
  走的是上面「原生节点」那条线——文字还是文字，图层带语义名，不是照着成图手摆的。
  以后改实现 → 重跑脚本 → 稿子重搭，稿子不会再落后好几轮。
  （Figma 那边还没跟上，那三条都还是 Figma 的事。）
- **Figma 变量与组件还没建**：v6 视觉方向 §7 步骤 2、3 说要先建变量与 9 个组件，
  实际是把**实现导出的几何**一次性搭成帧——稿子与实现同源已经达成，
  但「可复用组件」这件事还没做。
- **Figma 里的宽版帧还是旧的**：帧 `78:3290` 里那枚 3D 环位图（`80:3535`）还没删，
  几何说明页 `44:2626`（Ring / 3D 轨道矩阵）也待清；
  这一轮压掉 bloom 后的新整帧 SVG 也还没导进去。
  等切回对应 Figma 文件、figwright 面板开着时一起收。
- **Figma 稿子上还没有这三组新统计**：`TOP` / `ALERTS` 两屏在 Figma 那边
  仍是上一轮之前的样子，分模型命中率、节律、模型走向只进了实现与成图。
  补的时候按成图导出的几何走（`PREVIEW_DUMP=1`）。
