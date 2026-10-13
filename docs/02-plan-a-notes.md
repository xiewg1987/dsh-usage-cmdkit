# 方案 A：本地短笔记（实战规格）

目标：让模型通过工具 **写入 / 列出** 短文本备忘，数据落在本机文件里。你自己实现 Host；配置卡片为可选加分项。

## 1. 产品行为

用户可以说：

- 「帮我记一下：明天下午三点开会」→ 调用 `note_add`
- 「看看我记了哪些笔记」→ 调用 `note_list`

模型看到的工具结果应是清晰文本或简单结构化说明（`type: 'text'` 即可；协议里没有 `html` 块）。

## 2. 建议的工具

### `note_add`


| 项   | 建议                                              |
| --- | ----------------------------------------------- |
| 参数  | `text: string`（必填）                              |
| 行为  | 追加一条笔记（含时间戳）到存储文件                               |
| 返回  | 成功提示 + 当前条数，或新条目摘要                              |
| 失败  | 空字符串 → 在 `pre-execute` deny，或 `execute` 里抛成工具错误 |




### `note_list`


| 项   | 建议                          |
| --- | --------------------------- |
| 参数  | `limit?: number`（可选，默认如 10） |
| 行为  | 读取存储，返回最近 N 条               |
| 返回  | 编号列表文本；无数据时明确说「暂无笔记」        |


可选第三工具（加分）：`note_clear`（清空，建议 Config 开关或二次确认策略）。

## 3. Config（建议 Volatile）

```ts
// 规格示意——请你自己在 src 里落地
interface Config {
  /** 笔记文件绝对路径或相对插件数据目录的路径 */
  storagePath: Volatile<string>
  /** note_list 默认条数上限 */
  defaultLimit: Volatile<number>
  /** 允许存储的最大条数；超出时丢弃最旧或拒绝写入（二选一，文档化） */
  maxNotes: Volatile<number>
}
```

- 字段务必 `.volatile()`，否则以后做 Plugins 卡片时没有 `form`。
- 热更新：需要时监听 `loader/volatile-update`（`import type {} from '@deepseek-ai/cordis-plugin-loader'`）。



## 4. 存储格式（建议）

单文件 JSON，例如：

```json
{
  "version": 1,
  "notes": [
    { "id": "…", "text": "明天下午三点开会", "createdAt": "2026-10-12T08:00:00.000Z" }
  ]
}
```

- 路径默认放在用户可写位置（例如插件目录下 `data/notes.json`，或 Config 指定）。
- 读写注意：并发简单场景可串行；先实现正确再谈锁。



## 5. 安全与门禁

- `note_add`：`text` 空白 → deny。
- `storagePath`：避免写到任意系统目录；入门可限制在仓库 `data/` 下。
- 不要在工具结果里打印整盘路径以外的密钥。



## 6. 建议文件布局（你来创建）

```
src/
  index.ts          # 或 notes-plugin.ts：name / inject / Config / apply
  notes-store.ts    # 读写 JSON 的纯函数（可选拆分）
data/               # 默认笔记文件（可 gitignore 内容）
cordis.patch.yml    # id: notes，name: dsh-plugin
patch.dev.yml       # name: './src/….ts'，仅 Host 联调
```

当前仓库已留空壳 `src/index.ts`，把逻辑写进去或改名并改 `package.json` / patch 的入口。

## 7. 验收清单（自己打勾）

- [x] `pnpm run typecheck` 通过  
- [x] `--patch` 启动后，模型能 `note_add` 成功  
- [ ] `note_list` 能看到刚才那条  
- [ ] 空文本被拒绝  
- [ ] 改 Config 的 `defaultLimit` / `maxNotes` 行为符合文档（可用 patch 里的 `config:`）  
- [ ] （可选）Plugins 配置卡改 `storagePath`  



## 8. 明确不做（本阶段）

- 对话整页换肤、语音桌宠  
- 工具结果 HTML / 彩色气泡（无 `type: 'html'`；颜色需 toolview）  
- 完整复刻 harness 的 `clientBundle` 流水线（配置卡可后做；可先对照 `archive/greet-lab`）



## 9. 参考

- harness：`packages/core/tools` README（`defineTool`、流水线）  
- harness：`docs/cookbook/adding-a-settings-card.zh.md`（Volatile）  
- 本仓库：`archive/greet-lab`（仅对照，勿继续堆功能）

