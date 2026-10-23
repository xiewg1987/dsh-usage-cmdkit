# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-10-22

> **已定版（tag `v0.2.0`）但尚未发布到 npm** —— npm 与淘宝源的 `latest` 仍为 `0.1.1`。
> 本节描述的是仓库 HEAD 的能力；想用请从 Git 装。

### Notes

- **0.1 历史数据可能含重复计数**：`warning.code = "legacy"` 表示盘上的 `byProvider` 是按 0.1 语义写的——
  一个 turn 若走了多个 provider（重试 / fallback），整轮用量被记到了每个 provider 上，于是
  `sum(byProvider) > total`。**新写入的数据不再重复**，但历史聚合值无法自动还原。
  若你的用量跨多个 provider 且出现过重试 / fallback，把 profile 下的 `usage-stats.json`
  改名备份（例如 `usage-stats.json.bak`）让它从头记即可；单 provider 的用户无需处理。

### Added

- **数字可信**：多路由 turn 记入 `__mixed__`；窗口切换时 provider / 告警 / 指标块与同一日历窗对齐。
- **读盘 warning**：`UsageSummary.warning`（损坏隔离、版本不兼容、0.1 历史归因）。
- **底栏状态**：同步 / 过期 / 失败、更新时间、状态点；读失败保留旧数据并标 stale。
- **测试与 CI**：Host / Client 纯函数单测、协议与 i18n 校验；GitHub Actions（Windows + Ubuntu，Node 22/24）。

### Fixed

- 坏 JSON 隔离为 `.corrupt-*`，不再 500；未知版本不覆盖原文件。
- 清空前写 `.bak`；临时文件带 PID / 随机后缀；rename 有限重试。
- `retentionDays` 非法值回退 / 夹紧；日键与四桶计数校验。

## [0.1.1] - 2026-10-22

### Fixed

- **pnpm 11 安装**：`pnpm-workspace.yaml` 改用 `allowBuilds.esbuild: true`，替代已忽略的 `onlyBuiltDependencies`，避免 `pnpm install` 因 esbuild 构建脚本被跳过而失败。

### Changed

- 文档：`docs/steps/03` 补全 `/api/usage.summary` 响应字段；Phase D 配置项标注为 v0.3.0。
- README：更新 `lib/client.js` 产物体积说明（与当前构建一致）。

### Removed

- 删除 `UsageDashboard.tsx` 中未使用的 `deriveAlerts` 导入。

## [0.1.0] - 2026-10-22

首个公开发布。

### Added

- Host：turn 事件采集、`usage-stats.json` 日 rollup、Connection 路由 `/api/usage.summary` 与 `/api/usage.clear`。
- Client：DSH Web 右栏 Usage Tab；v6 窄栏 / 宽栏双构图；总览 / Top / 告警三屏与 loading 骨架。
- 四色环（未缓存输入 / 输出 / 缓存读 / 缓存写）；今日 / 7 日 / 30 日窗口；按 provider/model 聚合。
- 分模型缓存命中率、模型走向（30 日微折线 + 份额变化）、节律与阈值告警。
- 中英文文案；刷新 / 清空；入场动效与刷新插值。

[0.2.0]: https://github.com/xiewg1987/dsh-usage-meters/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/xiewg1987/dsh-usage-meters/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/xiewg1987/dsh-usage-meters/releases/tag/v0.1.0
