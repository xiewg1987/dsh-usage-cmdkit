# 封存对照：方案 A Phase 1（txt 笔记）

路径：`archive/notes-phase1/`。

## 当时练了什么

| 点 | 位置（归档内） |
|----|----------------|
| `note_add` / `note_list` | `src/index.ts` |
| 工作区 cwd + `storagePath` | `resolveNotesPath` |
| Config：defaultLimit / maxNotes | 同上 + `cordis.patch.yml` 快照 |
| 空文本 deny | `tools/pre-execute` |
| Phase 1 规格与打勾清单 | `docs/02-plan-a-notes-phase1.md` |

## 重要结论（Phase 2 继续用）

1. **模型入参** 只有 `parameters`；路径来自 **`exec.agent.session.header.cwd`** + **Config**。  
2. **工具 `return` 字符串** = 模型在轨迹里看到的工具结果（经 `render`）。  
3. **`note_list` 应自带正文**，避免模型再去 `read` 猜旧路径。  
4. 现网请在仓库根 **`src/`** 做 Phase 2（JSON），不要在 `archive/` 里改。
