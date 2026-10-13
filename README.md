# dsh-plugin

独立 DeepSeek Harness 插件仓库。当前练习：**方案 A Phase 2 — JSON 笔记存储**（自行实现）。

## 先读文档

| 文档 | 说明 |
|------|------|
| [docs/README.md](./docs/README.md) | 文档索引 |
| [docs/02-plan-a-notes.md](./docs/02-plan-a-notes.md) | **Phase 2 规格（从这里开干）** |
| [docs/03-dev-workflow.md](./docs/03-dev-workflow.md) | 怎么启动、怎么验收 |
| [docs/01-overview.md](./docs/01-overview.md) | Host / Web 边界 |

## 仓库布局

```
docs/                      说明与规格（权威）
src/index.ts               Phase 2 空壳（你来填 notes-store + 工具）
patch.dev.yml              --patch 联调
cordis.patch.yml           plugin add / profile
archive/greet-lab/         封存：greet 实验
archive/notes-phase1/      封存：Phase 1 txt 笔记（完整代码+文档）
```

## 快速联调

```powershell
cd D:\ScriptProject\dsh-plugin
pnpm install
pnpm run typecheck

cd D:\ScriptProject\deepseek-harness
pnpm dsh web --patch ../dsh-plugin/patch.dev.yml
```

## 封存说明

- greet：`archive/greet-lab/` → [docs/04-reference-archived-greet.md](./docs/04-reference-archived-greet.md)
- Phase 1 笔记：`archive/notes-phase1/` → [docs/05-reference-archived-notes-phase1.md](./docs/05-reference-archived-notes-phase1.md)

不要在 `archive/` 里继续当现网开发。

## Git

在本目录提交；不要提交到 `deepseek-harness`。`data/` 若存放笔记，建议忽略内容（见 `.gitignore`）。
