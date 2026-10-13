# 开发与联调

## 依赖

```powershell
cd D:\ScriptProject\dsh-plugin
pnpm install
```

`package.json` 里 `@deepseek-ai/*` 通过 `link:` 指向旁路 `../deepseek-harness`。

## 推荐：只测 Host（方案 A 日常）

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh web --patch ../dsh-plugin/patch.dev.yml
```

- `patch.dev.yml` 里 `name` 用 **源码路径**（如 `./src/index.ts`），改 Host 易 HMR。  
- 此路径 **不会**加载浏览器半 `./client`。  
- 端口 **3080** 只能有一个 dsh web；换命令前先 Ctrl+C。

若 install 卡在 lefthook：`$env:CI='true'; pnpm install`。

## 可选：装进 profile（配置卡 / 裸包名）

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh plugin --profile web add D:/ScriptProject/dsh-plugin
pnpm dsh web
```

- `cordis.patch.yml` 使用 `name: dsh-plugin`（裸包名）。  
- 与 `--patch` **不要叠在同一次启动**。  
- profile 里若还有旧的 `my-dsh-plugin` / 旧 greet，先关掉以免抢工具名。

## 类型检查

```powershell
cd D:\ScriptProject\dsh-plugin
pnpm run typecheck
```

## 怎么确认工具真的跑了

1. 展开对话里「已完成，用时 x 秒」看 **工具结果**（不是助手聊天气泡）。  
2. 看 Host 终端日志（若你在 `tools/result` 里 `console.log`）。  
3. 助手说「已记好」≠ 文件一定写入；以工具结果 + `data/` 文件为准。

## 流水线速记

```
pre-execute → execute → render → post-execute → result(只读)
```

正常业务：多数结果由 `execute` 决定；`post-execute` 只做拦截或少数改写。
