# 方案 A Phase 1：txt 行存储（已封存）

> 完整实现见 `../src/index.ts`。现网练习已进入 Phase 2，见仓库根 `docs/02-plan-a-notes.md`。

目标：让模型通过工具 **写入 / 列出** 短文本备忘；**一行一条**，默认写在 **当前会话工作区 cwd** 下的 `notes.txt`。

## Phase 1 已实现要点

- `note_add` / `note_list`，`resolveNotesPath(config, exec)`（工作区 cwd + Config `storagePath`）
- Config：`storagePath`、`defaultLimit`、`maxNotes`（volatile）
- 空 `text` → `tools/pre-execute` deny
- `maxNotes`：已有条数 ≥ 上限则拒绝追加（非空行计数）

## 7. 验收清单（Phase 1 已完成）

- [x] `pnpm run typecheck` 通过  
- [x] `--patch` 启动后，模型能 `note_add` 成功  
- [x] `note_list` 能看到刚才那条  
- [x] 空文本被拒绝  
- [x] 改 Config 的 `defaultLimit` / `maxNotes` 行为符合文档（可用 patch 里的 `config:`）  
- [ ] （可选）Plugins 配置卡改 `storagePath`  

## 参考

- 封存说明：仓库根 `docs/05-reference-archived-notes-phase1.md`
