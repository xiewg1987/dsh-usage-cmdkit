# dsh-usage-cmdkit 文档

实施顺序（**先 Host、后 Client**），三步均已实现：

| 步骤 | 文档 | 产出 | 状态 |
|------|------|------|------|
| **1** | [01-collect-usage-stats.md](./01-collect-usage-stats.md) | 从 DSH 可靠拿到 **每 turn** 的 token 统计（与 Web「本轮用量」同源） | ✅ `src/turn-events.ts` + `src/index.ts` |
| 2 | [02-persist-stats.md](./02-persist-stats.md) | 累加写入 profile 下 `usage-stats.json`，按日 rollup + 30 天 prune | ✅ `src/usage-store.ts` |
| 3 | [03-remotes-and-client.md](./03-remotes-and-client.md) | 认证路由暴露聚合；Client 右栏 Dashboard | ✅ `src/host-routes.ts` + `src/client/` |

统一说明与设计取舍见 **[00-项目说明.md](./00-项目说明.md)**。

外部参考（harness 仓库，非本插件依赖说明）：

- [extension-cookbook.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/extension-cookbook.zh.md) — `session/event` 与 UI 插件边界  
- [token-meter README.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/llm/token-meter/README.zh.md) — `deriveTurnTokenUsage`、四桶字段  
- [API Gateway 参考](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/api-gateway.zh.md) — 为什么官方 remote 通道对第三方插件关闭
