# dsh-plugin

DeepSeek Harness 插件仓库 — **当前：从零学习 Client 半（React 配置卡）**。

## 开始

1. 读 [docs/02-client-learning.md](./docs/02-client-learning.md)  
2. 在 **`src/client/`** 写 React（目录里仅有 README 占位）  
3. Host 已在 **`src/index.ts`**（最小 Config，勿写 UI）

## 布局

```
src/index.ts           Host（Config only）
src/client/            你来写 React
lib/client.js          pnpm run build:client 生成
archive/greet-lab/     完整 Host+Client 对照
archive/notes-phase1/
archive/pre-client-learning-2026-10-13/   本次清空前快照
```

## 联调 UI

```powershell
pnpm dsh plugin --profile web add D:/ScriptProject/dsh-plugin
pnpm dsh web
```

`--patch` 仅 Host，**看不到** Configure 卡片。
