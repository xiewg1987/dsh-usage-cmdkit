# dsh-usage-dashboard 文档

现网实施顺序（**先 Host、后 Client**）：

| 步骤 | 文档 | 产出 |
|------|------|------|
| **1** | [01-collect-usage-stats.md](./01-collect-usage-stats.md) | 从 DSH 可靠拿到 **每 turn** 的 token 统计（与 Web「本轮用量」同源） |
| 2 | [02-persist-stats.md](./02-persist-stats.md) | 累加写入 profile 下 `usage-stats.json`，按日 rollup + 30 天 prune |
| 3 | [03-remotes-and-client.md](./03-remotes-and-client.md) | remotes 暴露聚合；Client 右栏 Dashboard |

**当前应只做第 1 步**：能在 Host 终端（或内存）看到与聊天 UI 一致的 turn 用量，再考虑落盘与 UI。

外部参考（harness 仓库，非本插件依赖说明）：

- [extension-cookbook.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/extension-cookbook.zh.md) — `session/event` 与 UI 插件边界  
- [token-meter README.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/llm/token-meter/README.zh.md) — `deriveTurnTokenUsage`、四桶字段  
