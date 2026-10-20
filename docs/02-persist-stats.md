# 步骤 2：持久化统计

**前置条件**：[步骤 1](./01-collect-usage-stats.md) 已在 `turn/end` 稳定得到 `TurnTokenUsage`。

## 做什么

- 在 Host 用 `fs` 读写 **profile 目录** 下单个 JSON（默认如 `usage-stats.json`）。  
- 结构：**按本地日 `YYYY-MM-DD` rollup**，桶字段与步骤 1 相同；可选 `byProvider`（来自 `routes`，键为 `provider/model`）。  
- 每次 merge 后 **`prune`** 掉保留窗口外的日键。  
- Client **仍不读盘**；本步可用脚本或 log 验证文件内容递增。

### prune 的语义

`pruneDays(file, nowMs)` 按**本地日历日**裁剪：只保留「今天往前 `retentionDays - 1` 天」内的日键。

- 窗口用**本地日历算术**（`new Date(y, m, d - n)`）推进，不是减 24 小时——
  跨夏令时的那天只有 23 或 25 小时，减固定毫秒会落错日。
- 早先的实现按**条数**保留最近 N 个日键。那样停用一段时间后，
  只剩一两个日键时永远不会触发裁剪，旧的日键会一直留着，与「保留约 30 天」的意图不符。
- 参考时刻是**写入时刻**（turn 结束时间），不依赖墙上时钟读数。

### 读-改-写

所有写盘走一条**串行写链**（`writeChain`）：读文件 → merge → 写临时文件 → `rename` 原子替换。
并发 turn 不会互相覆盖；清空也走同一条链。

## 不做

- 数据通道与 Dashboard UI（步骤 3）。

## 验收

- 联调后查看 **`$DSH_PROFILE_DIR/usage-stats.json`**；
  未设置时用 **Harness home 下的 `profiles/web/usage-stats.json`**
  （home = `$DSH_HOME`，否则 `~/.dsh`；与 harness 的 `resolveDshHome` 规则一致）。
  **不**退回当前工作目录——harness 常从源码仓库启动，退回 cwd 会把统计文件写进别人的源码树。  
- 每完成一轮有模型的 turn，对应 **dayKey** 下 `total` 四桶递增；终端会打 `[dsh-usage-dashboard] 已写入`。  
- 文件里出现两个日键时，旧日会被 prune 掉（超出保留窗口的那个）。  
- 清空 = 删除文件或重置 `days: {}`（步骤 3 已暴露 `POST /api/usage.clear`）。
