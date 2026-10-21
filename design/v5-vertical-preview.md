# 竖屏（360×800）预览说明 · DSH CmdKit v5 金融版

![竖屏 360×800 预览](https://raw.githubusercontent.com/xiewg1987/dsh-usage-cmdkit/main/design/dsh-cmdkit-v5-360x800.png)

> 成图：`design/dsh-cmdkit-v5-360x800.png`（360×800，2 倍图 720×1600）。
> 本文件说明这张图**是什么**、**怎么来的**、以及每一块对应实现的哪段代码。

## 这张图是真实组件渲染的

预览图不是另画的静态稿，而是把 `src/client/UsageCompact.tsx` 里的竖屏面板
**原样挂进浏览器**截出来的：

```
design/_v5_src/preview-360.tsx      # 预览入口：喂 mock 数据 + en 字典
design/_v5_src/render-preview.mjs   # esbuild 打包 → Chrome(CDP) → 截图
node design/_v5_src/render-preview.mjs
```

所以「设计稿」与「实现」是同一份东西：改了样式再跑一次脚本，图就跟着变；
设计与实现不会各走各的。

渲染用 **CDP + 真实时钟**（导航后真的等 2.6 秒再截图）。
`chrome --headless --screenshot --virtual-time-budget=…` 截的是「入场前」——
Web Animations 的入场与 rAF 的数字滚动都不推进，数字会停在 0。

> `design/_v5_src/` 是本地工作区（不进版本库），与 `design/_v4_src/` 同理。

## 版面构成（从上到下）

| 区块 | 内容 | 实现位置 |
|---|---|---|
| 品牌头 | `DSH CmdKit`（左）+ `Usage`（右） | `UsageChrome.tsx` `BrandHeader` |
| 视图 Tab | `OVERVIEW / TOP / ALERTS`，后两个是禁用态 | `UsageChrome.tsx` `ViewTabs` |
| 时间窗 | `TODAY / 7 DAYS / 30 DAYS`（当前 30 DAYS） | `UsageChrome.tsx` `WindowPills` |
| 主指标卡 | `742.6K` + `TOKENS · 30D` + 日均；右侧 64px 小环（未缓存输入占比 38%） | `UsageCompact.tsx` `MiniRing` |
| 指标卡 | `CACHE HIT RATE 36.5%`，副行 `163,720 cached`（涨跌绿） | `UsageChrome.tsx` `Kpi` |
| 分类列表 | UNCACHED INPUT / OUTPUT / CACHE READ / CACHE WRITE：圆点 + 绝对数 + 百分比 + 5px 细条 | `UsageTelemetry.tsx`（`variant="flat"`） |
| 洞察卡 | 一句话说明，扁平卡片（深灰半透明，无霓虹） | `UsageChrome.tsx` `Insight variant="card"` |
| 状态条 | `dsh-usage-cmdkit · synced · local ok · v0.1.0` + `Refresh / Clear` | `UsageChrome.tsx` `StatusFooter` + `usage-version.ts` |

## 视觉规矩

- **底色**：`#070a12`（近黑的午夜蓝），**没有网格**；卡片是 `rgba(255,255,255,0.035)` +
  `rgba(255,255,255,0.06)` 描边的圆角块，没有霓虹描边。
- **强调色只有两种**：界面色蓝青 `#38bdf8`（选中态、进度环、时间窗标签），
  涨跌绿 `#22c55e`（命中率副行）。其余一律灰阶。
- **品类色退回到「一颗小圆点 + 一条 5px 细进度条」**：蓝 / 绿 / 紫 / 橙，
  不发光、不画柱；百分比也跟着走灰阶，颜色只标注数据。
- **小环**（直径 64px）只有一条蓝青进度 + 一圈暗灰轨道，讲的是「未缓存输入占总量的比例」——
  旧版那种四段彩虹大环没有了。
- **留白优先**：内容只有一屏放得下（`contentHeight === clientHeight === 768`），
  洞察卡与底栏之间是刻意留的空，不拿装饰填。
- **底栏是 sticky 的**：宿主右栏只有几百像素高，面板比视口高时状态条仍贴在
  可视区底部（`position: sticky` + 不透明底色），不用往下滚才看得见。

## 与旧竖屏版的差别

| | 旧（v5 · 3D 轨道矩阵） | 新（金融竖屏） |
|---|---|---|
| 主视觉 | 直径 170–300px 的 3D 四段彩虹环 | 42px 大数 + 64px 单色小环 |
| 底纹 | 平视网格 + 四角角标 | 无网格、无角标 |
| 分类色 | 发光柱 + 渐变条 + 彩色百分比 | 小圆点 + 5px 实心细条 + 灰色百分比 |
| 洞察 | 竖线 + 霓虹蓝字 | 扁平说明卡 |
| 分类行标签 | 全名（输入（未命中缓存）） | 短名（UNCACHED INPUT） |
| 状态条 | `… · 09:26:50`（同步时刻） | `… · v0.1.0`（版本号；同步时刻移到悬停提示） |

**没动的**：数据口径（四桶 token、命中率）、交互入口
（时间窗切换、视图 Tab、刷新/清空）、中英文案字典的既有措辞。

## 这一版被删掉的两块

同期的另一条改造线把**命令面板**（⌘J / `Ctrl+Alt+J`、`Commands` Tab、面板底部那条命令入口）
和**费用估算**（费率表、`Cost Est.` 指标卡、`COST` 视图）整个去掉了——
本竖屏版跟随该方向，于是：

- 顶部视图 Tab 从 `OVERVIEW / COST / TOP / ALERTS` 变成 `OVERVIEW / TOP / ALERTS`；
- 指标卡从两枚（命中率 + 花费）变成一枚（只有命中率）；
- 品牌头右侧的 `Usage | Commands` 切换器只剩 `Usage`；
- 底栏命令入口整条移除，状态条直接落到最下面。

对应地，插件里不再有「报钱」的部分：`usage-pricing.ts`（费率与 ¥ 换算）已删除，
命中率换算独立到 `usage-metrics.ts`。

## 两处刻意的取舍

1. **版本号来自构建期**：底栏的 `v0.1.0` 由 `package.json` 的 version 注入
   （`scripts/build-client.mjs` 的 define），包版本是唯一事实来源；
   同步时刻降级成状态条的悬停 title。
2. **宽面板（≥900px）仍是 3D 轨道矩阵双栏**。这一版只重做了竖屏；
   宽版要一起换成扁平版，说一声就行。

## Figma

Figma 里对应的帧是 `DSH CmdKit v5 · 金融竖屏 — 360x800`
（页 `Hero Image / usage-dashboard`），用 figwright 逐层搭的：
卡片 / 药丸 / 圆点 / 细条 / 进度环都是可编辑图层，文案与配色与实现一一对应，
且与上面这张预览图逐块对齐（删掉花费卡与命令入口后重新排过位）。
