# 方案 A Phase 2：JSON 笔记存储（当前练习）

Phase 1（txt + 工作区路径 + Config）已封存：`archive/notes-phase1/`。  
你在 **仓库根 `src/`** 从这里继续实现；对照归档代码与文档，不要改 `archive/` 里的实现。

## 1. 目标

- 仍用 `note_add` / `note_list`（工具名可不变）
- 存储改为 **单文件 JSON**（见 §3），含 `id`、`text`、`createdAt`
- **路径规则**与 Phase 1 一致：默认当前会话 **工作区 cwd** 下的文件（Config `storagePath` 默认如 `notes.json`）
- 复用 Phase 1 的 Config 语义：`defaultLimit`、`maxNotes`（拒绝写入或丢最旧——在文档里写清你选的策略）

## 2. 建议步骤

1. 新建 `src/notes-store.ts`：读/写 JSON、追加一条、列出最近 N 条、条数统计  
2. `src/index.ts`：注册工具，调用 store；`pre-execute` 空文本 deny（可从 Phase 1 复制思路）  
3. `note_list` 返回：**文件路径 + 共 M 条 + 显示最近 N 条 + 编号列表**（减少模型乱调 `read`）  
4. `note_add` 成功返回可带 **当前总条数**

## 3. 存储格式

```json
{
  "version": 1,
  "notes": [
    { "id": "uuid-or-nano", "text": "明天下午三点开会", "createdAt": "2026-10-13T03:00:00.000Z" }
  ]
}
```

- 文件不存在 → 视为 `{ "version": 1, "notes": [] }` 再写入  
- `maxNotes` 超出：拒绝新条 **或** 删除最旧条目（二选一，写在代码注释或本文档）

## 4. 建议布局

```
src/
  index.ts          # apply、工具注册、pre-execute
  notes-store.ts    # 纯函数：路径解析可仍放 index 或单独 util
patch.dev.yml       # --patch 联调
cordis.patch.yml    # plugin add
```

## 5. 验收清单（Phase 2，自己打勾）

- [ ] `pnpm run typecheck` 通过  
- [ ] JSON 落在工作区下 Config 指定路径（默认 `notes.json`）  
- [ ] `note_add` 写入后文件为合法 JSON，含时间戳  
- [ ] `note_list` 与 add 数据一致；默认 `defaultLimit` 生效  
- [ ] 空文本 deny；`maxNotes` 行为与文档一致  
- [ ] （可选）从 Phase 1 的 `notes.txt` 手动迁移一条做肉眼对照  

## 6. 明确本阶段不做

- Plugins 配置卡（可 Phase 3；对照 `archive/greet-lab`）  
- `note_clear`（加分项，做完上面再做）

## 7. 参考

- Phase 1 归档：`archive/notes-phase1/`、`docs/05-reference-archived-notes-phase1.md`  
- 联调：`docs/03-dev-workflow.md`  
- harness：`packages/core/tools` README（`defineTool`）
