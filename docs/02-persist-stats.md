# 步骤 2：持久化统计

**前置条件**：[步骤 1](./01-collect-usage-stats.md) 已在 `turn/end` 稳定得到 `TurnTokenUsage`。

## 做什么

- 在 Host 用 `fs` 读写 **profile 目录** 下单个 JSON（默认如 `usage-stats.json`）。  
- 结构：**按本地日 `YYYY-MM-DD` rollup**，桶字段与步骤 1 相同；可选 `byProvider`（来自 `routes`）。  
- 每次 merge 后 **`prune`** 掉早于 `retentionDays`（默认 30）的日键。  
- Client **仍不读盘**；本步可用脚本或 log 验证文件内容递增。

## 不做

- remotes、Dashboard UI（步骤 3）。

## 验收

- 连续聊两天（或改系统日测试）：文件里有两个日键，旧日会被 prune。  
- 清空 = 删除文件或重置 `days: {}`（步骤 3 再暴露 `clearUsage` remote）。
