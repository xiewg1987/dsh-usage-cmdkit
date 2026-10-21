# v6 · 视觉方向方案（下一轮竖屏重做的依据）

> 这份文件是**给下一轮 Figma 出图用的作业书**：左边是参考来源，右边是能直接落到
> Figma 变量与组件上的规则。照着做，稿子和实现不会再各走各的。
>
> 整理时间：2026-10-21 · 参考采集：Pinterest（内置浏览器，公开搜索页）
> Figma 对应页：`v6 · 视觉方向与参考`（参考图已经铺在那个 Section 里）

---

## 0. 一句话方向

**暗色金融终端的密度，Apple 备忘录的克制。**
信息密但不吵：上密下疏、数值压过装饰、颜色只用来标注状态。

---

## 1. 参考来源

### 1.1 图集（board）

| 图集 | 规模 | 链接 | 主要拿什么 |
|---|---|---|---|
| Dashboard UI — Orbitx Studio | 513 张 | https://www.pinterest.com/orbixstudio/dashboard-ui/ | 暗色 SaaS 仪表盘的卡片骨架、间距 |
| Dashboard UI Design \| Best SaaS Trends 2026 — Taqwah | 94 张 | https://www.pinterest.com/taqwah_agency/dashboard-ui-design-best-saas-trends-2026/ | 现代卡片+圆角+渐变标题的做法 |
| Dashboard Design — Mostafiz | 60 张 | https://www.pinterest.com/mostafizurUX24/dashboard-design/ | 桌面仪表盘的密度参考 |
| **Fintech & Crypto UI/UX Mobile App Design Ideas** | 18 张 | https://www.pinterest.com/brandupyourapp/fintech-crypto-uiux-mobile-app-design-ideas/ | **最贴近**：移动端金融暗色 |
| **System Interface & Dark UI Architecture** — Kseniya Artman | 217 张 | https://www.pinterest.com/kseniyaartman/system-interface-dark-ui-architecture/ | **暗色系统怎么分层**：底色阶、描边、密度 |
| Figma dashboard UI kit — Setproduct | 74 张 | https://www.pinterest.com/setproduct/figma-dashboard-ui-kit/ | 组件化清单（我们只借组件划分） |

### 1.2 关键图钉（pin）

| # | 图钉 | 链接 | 借鉴点 |
|---|---|---|---|
| 01 | Crypter UI Kit — Banking, Crypto, Trading | https://www.pinterest.com/pin/1092052609675769223/ | 深蓝黑底 + 卡片 + 小 sparkline 的系统感 |
| 02 | **Crypto Trading App UI Design · Premium Dark Mode Fintech（Omnix）** | https://www.pinterest.com/pin/1093882197028854033/ | **大数 + 绿色 delta chip**、行内 sparkline、列表行骨架 |
| 03 | Mobile Dark UI Design（整套暗色系统） | https://www.pinterest.com/pin/728668414728526446/ | 暗色系统组件库：卡片、药丸、分段控件 |
| 04 | **深色钱包（余额 + 列表）** | https://www.pinterest.com/pin/892064638694775876/ | **分段选择器**（暗底 + 选中项浅药丸）、token 行结构 |
| 05 | RobotWallet: Crypto iOS UI Kit | https://www.pinterest.com/pin/817614507358222350/ | 卡片内边距、圆角刻度（借骨架，不借配色） |
| 06 | 深色分析类 kit | https://www.pinterest.com/pin/1123085225874020969/ | 统计块与环形仪表 |
| 07 | **MuleBox 暗色桌面仪表盘** | https://www.pinterest.com/pin/824581013022496549/ | **1px 描边卡片 + 灰阶标签 + 右侧右对齐数值** |
| 08 | 移动端深色分析 | https://www.pinterest.com/pin/887772145324289266/ | 持仓表三列 stat 的排法 |
| 09 | **图表组件库（近黑）** | https://www.pinterest.com/pin/467318898852397045/ | **环形仪表、统计块、双色进度条、渐变面积卡** |
| 10 | **仪表盘面板（深蓝）** | https://www.pinterest.com/pin/816840451211218305/ | **一排小圆表盘**（32/23/24/31 那种）—— 我们的四类可以这样表达 |
| 11 | 深色移动组合 | https://www.pinterest.com/pin/566046246941537009/ | 占比条、交易日热力 |

> 图片只作**内部灵感参考**，不放进仓库、不进产品。本地副本在 `design/_refs/`
> （已 gitignore），Figma 里已铺一份到 `v6 · 视觉方向与参考` 页。

---

## 2. 视觉系统（v6 的硬规矩）

### 2.1 色

| 角色 | 值 | 用在哪 |
|---|---|---|
| 面板底 | `#070a12` | 整个面板 |
| 卡片底 | `rgba(255,255,255,.035)` | 所有卡片 |
| 卡片描边 | `rgba(255,255,255,.06)`，1px INSIDE | 所有卡片 |
| 发丝线 | `rgba(255,255,255,.07)`，1px | 分隔线、进度条轨道 |
| 主强调 | `#38bdf8` | 选中态、进度、聚焦环 |
| 正向 | `#22c55e` | delta 上涨、命中率副值 |
| 负向 | `#ef4444` | delta 下跌（只在有负值时出现） |
| 主文本 | `#f2f5f9` | 数值 |
| 次文本 | `#8b94a3` | 标签、说明 |
| 三级文本 | `#5b6472` | 脚注、版本号 |

**强调色上限 = 2**（蓝青 + 涨跌绿/红）。品类色（未缓存/输出/缓存读/缓存写）
只允许出现在**圆点与细条**上，百分比一律灰阶——这条 v5.1 已经做对，保留。

### 2.2 字

- 数字：Inter，`font-variant-numeric: tabular-nums`，字重 600–700。
- 标签：JetBrains Mono 或 Inter，9–10px，字距 `0.12em`，全大写。
- 中文标签用 Inter（不套字距，中文全大写会散）。

| 级别 | 字号 | 字重 | 用途 |
|---|---|---|---|
| 大数 | 40–44 | 700 | 总 tokens |
| 指标数 | 22–24 | 700 | 命中率等 stat |
| 正文 | 13 | 500 | 分类行名、洞察正文 |
| 标签 | 10 | 500 | 卡片标签、药丸 |
| 脚注 | 9 | 400 | 版本号、同步时刻 |

### 2.3 间距与形状

- 间距刻度 **4 的倍数**：4 / 8 / 12 / 16 / 20 / 24。
- 卡片圆角 **12**（大卡）/ **10**（小卡）；面板圆角 14。
- 卡片内边距：主指标卡 16，四行列表卡 14×14，stat 卡 12×13。
- 卡片之间垂直间距：**12**（密）或 **16**（疏）；同一组内 8。
- 行高：分类行 **44**；stat 卡高 **64–72**；药丸高 **24**（紧凑 20）。

---

## 3. 组件清单（Figma 里要真的建出来）

| 组件 | 尺寸 | 内部结构 | 变体 |
|---|---|---|---|
| `StatTile` | 150×64 | 标签 10 / 数值 22 / 4px 微条 | accent · plain |
| `DeltaChip` | 自适应，高 20 | ↑ 12% 绿字 + 底色 8% 绿 | up · down · none |
| `Sparkline` | 56–120×24 | 1.5px 折线 + 端点圆点 3px | accent · 灰 |
| `MiniGauge` | 56–72 直径 | 轨道 4px `#1c2433` + 进度 4px 蓝青 + 环心数字 | 圆环 / 半环 |
| `CategoryRow` | 328×44 | 圆点 6 / 名称 13 / 细条（轨道+实心 4–6px）/ 绝对数 / 百分比 | 四品类各一色 |
| `InsightCard` | 328×72 | 小标题 10 + 正文 13 两行 + 右侧 64px 占比条 | — |
| `SegmentedControl` | 高 28 | 暗底容器 + 选中项浅色药丸（不是蓝底实心块） | 3 项 |
| `WindowPill` | 高 24 | 描边药丸；选中为蓝青实心 | 3 档 |
| `StatusBar` | 高 24 | 状态点 6（绿）/ 文本 9 / 版本号 9 / ghost 按钮 | — |

---

## 4. 竖屏 360×800 新版面骨架

从上到下的**密度节奏**：上密（头 / 控件 / 主指标 / stat）→ 中疏（分类列表）→ 收口（洞察 / 状态条）。

| 区块 | 高度 | 关键变化（相对 v5.1） |
|---|---|---|
| 品牌头 | 44 | 左侧 `DSH CmdKit` 16px，右侧 `Usage` 9px 灰字 |
| 分隔线 | 1 | 发丝线 |
| 控件行 | 32 | 视图 Tab 改成 **SegmentedControl**（暗底容器），时间窗药丸右对齐 |
| 主指标 | 150 | 大数 44 + **DeltaChip** + **Sparkline 120×24**；右侧 `MiniGauge 72` 改表**命中率** |
| stat 行 | 72 | **两枚横排**（命中率 / 缓存读比），不再是单枚高卡 |
| 分类列表 | 204 | 4 行 × 44，行内加**微型 sparkline**；行间发丝线 |
| 洞察卡 | 72 | 小标题 + 两行正文 + 右侧占比条 |
| 弹性空隙 | 余量 | 上密下疏的留白落在这里 |
| 状态条 | 24 | 绿点 + `dsh-usage-cmdkit · synced · local ok` + 版本号 + ghost 按钮 |

合计约 **660px + 间距**，落在 800 里余 ~90px 呼吸——**留白集中在下半段**，
这是与 v5.1「上中下均匀、底部一大块空」最大的差别。

---

## 5. v5.1 现在为什么还是不好看

对着上面的参考逐条比，当前这版（`design/dsh-cmdkit-v5-360x800.png`）的问题：

1. **一枚指标卡占满整行还 95px 高** —— 一个数字浮在中间，空白比信息多。
   参考里这一层永远是「两枚 stat」或「stat + delta」。
2. **右侧 64px 环信息量低且重复** —— 它表示「未缓存输入占比 38%」，
   而下面列表第一行已经写了 38%。参考里的环通常表达一个**别处没有的量**
   （命中率、进度），建议改成命中率环。
3. **大数下面只有「日均 24.8K」一行字，没有趋势** —— 参考里大数正下方是
   delta chip 或 sparkline。我们有日数据却没画出来。
4. **分类行只有圆点+条+数字，看不出波动** —— 参考里每行右侧带一段微型 sparkline。
5. **洞察卡是纯文字一段** —— 参考里是「小标题 + 说明 + 占比条」三层。
6. **顶部两套控件打架** —— `OVERVIEW/TOP/ALERTS` 用下划线选中态，
   时间窗用实心蓝药丸，两个选中语言放在一行很吵。改成暗底分段容器 + 描边药丸。
7. **状态条没有状态点** —— 刷新/清空按钮与状态文字都是小字，缺一个「活着」的信号。
8. **卡片内文字偏贴边** —— 内边距 12–14 在 360 宽下显得挤，行高应到 44。
9. **密度均匀** —— 上中下一样松。金融竖屏是**上密下疏**。

---

## 6. 明确不要做的（反面参考：Figma 参考区里的 08）

- ❌ 霓虹多色大环、四段彩虹环、发光柱、渐变描边
- ❌ 满屏网格与四角角标
- ❌ 暖棕 / 粉紫渐变底（参考 06 只借结构，不借色）
- ❌ 每一块都带装饰性插画
- ❌ 四个以上强调色

---

## 7. Figma 作业顺序

1. 在 `v6 · 视觉方向与参考` 页新建 Section `v6 · 竖屏 360×800`（画布 360×800）。
2. 先建 **变量**：`color/` 8 个、`space/` 4 的倍数、`radius/` 10-12-14、`type/` 5 级。
3. 再建上表 9 个组件（都做成真组件，不是散图层）。
4. 按第 4 节骨架拼一版 360×800。
5. 旁边再出**宽版 1280×720** 一版（宽版仍是 3D 轨道矩阵，但卡片/标签语言要和竖屏统一）。
6. **验收**：出图后必须用真实组件渲染一张对照图，逐块比。
   规矩见 `design/v5-vertical-preview.md`「这张图是真实组件渲染的」——
   `design/_v5_src/render-preview.mjs` 走 CDP + 真实时钟，不许用静态稿糊弄。

---

## 8. 改了实现就要同步这三处

| 位置 | 内容 |
|---|---|
| `src/client/usage-theme.ts` | 色 / 间距 / 圆角常量（单一事实来源） |
| `src/client/UsageCompact.tsx` | 竖屏构图 |
| `design/v5-vertical-preview.md` | 逐块对照表 + 预览成图 |

设计稿改了但实现没跟上 = 漂移；实现改了但稿子没跟上 = 另一份漂移。
两边都要动，且用真实组件渲染的那张图来做裁判。
