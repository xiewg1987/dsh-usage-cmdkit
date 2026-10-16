# 步骤 3：remotes 与 Client

**前置条件**：步骤 1 统计正确，步骤 2 文件可读写。

## Host remotes

| 方法 | 行为 |
|------|------|
| `getUsageSummary()` | 读 JSON，返回 `{ today, d7, d30, byProvider }` |
| `clearUsage()` | 清空统计文件 |

实现方式见 harness cookbook [adding-a-remote-api.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-remote-api.zh.md)。

## Client

- 槽位：**右栏 Tab**（`sidebarRightTabs`）。  
- 构建：`pnpm run build:client` → `lib/client.js`；联调必须用 **`plugin add`**（`cordis.patch.yml` 裸包名），不要用 `--patch` 测 UI。  
- 刷新：再次调用 `getUsageSummary()`；清空：调 `clearUsage()`。

## 可选 Phase D

Volatile Config：`storagePath`、`retentionDays`（Schema + Configure 或 Dashboard 内编辑）。
