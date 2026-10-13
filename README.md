# dsh-plugin

独立 DeepSeek Harness 插件仓库。当前实战：**方案 A — 本地短笔记**（自行实现）。

## 先读文档

| 文档 | 说明 |
|------|------|
| [docs/README.md](./docs/README.md) | 文档索引 |
| [docs/02-plan-a-notes.md](./docs/02-plan-a-notes.md) | **A 的完整规格（从这里开干）** |
| [docs/03-dev-workflow.md](./docs/03-dev-workflow.md) | 怎么启动、怎么验收 |
| [docs/01-overview.md](./docs/01-overview.md) | Host / Web 边界 |

## 仓库布局

```
docs/                 说明与规格（权威）
src/index.ts          Host 空壳（你来填）
patch.dev.yml         --patch 联调
cordis.patch.yml      plugin add / profile
archive/greet-lab/    已封存的 greet 实验（只读对照）
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

旧的 greet 工具 / 配置卡 / 手写 `lib/client.js` 已移到 `archive/greet-lab/`，**不要**再当作现网入口。对照见 [docs/04-reference-archived-greet.md](./docs/04-reference-archived-greet.md)。

## Git

在本目录提交；不要提交到 `deepseek-harness`。`data/` 若存放笔记，建议忽略内容（见 `.gitignore`）。
