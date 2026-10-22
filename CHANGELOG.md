# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.1]: https://github.com/xiewg1987/dsh-usage-meters/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/xiewg1987/dsh-usage-meters/releases/tag/v0.1.0
