# dsh-plugin

独立 DeepSeek Harness 插件仓库（可长期开发与提交）。从 `deepseek-harness/scratch-plugin` 迁出。

## 布局

| 文件 | 用途 |
|------|------|
| `src/hello-plugin.ts` | 插件：`greet` 工具 + Config 门禁 + post/result 钩子 |
| `patch.dev.yml` | 源码联调：`pnpm dsh web --patch` |
| `cordis.patch.yml` | 组合包层：`dsh plugin add` / profile bundles |
| `package.json` | `dsh.bundle`；peer 链到旁路的 `deepseek-harness` 供类型检查 |

## 源码联调（旁路 harness）

先在本目录安装依赖（把 `@deepseek-ai/*` link 到 `../deepseek-harness`）：

```sh
cd D:\ScriptProject\dsh-plugin
pnpm install
```

再启动 Web（在 harness 根目录）：

```sh
cd D:\ScriptProject\deepseek-harness
pnpm dsh web --patch ../dsh-plugin/patch.dev.yml
```

改 `src/` 或 `patch.dev.yml` 一般会 HMR；不行就重启上述命令。

## 安装进自己的 profile（可提交本仓后长期用）

```sh
dsh plugin --profile mydemo add D:/ScriptProject/dsh-plugin
dsh --profile mydemo --dump-config
```

Web 面请用带 web 的 profile / 模板，或继续用上一节的 harness `--patch` 联调。

## 门禁配置

编辑 `patch.dev.yml` 或 `cordis.patch.yml` 的 `config`：

- `preDenyNames`：执行前 deny（不跑 `execute`）
- `postBlockNames`：执行后 block（先跑成功再改成错误）；勿与 `preDenyNames` 重叠
- `greeting`：问候前缀

## Git

在本目录初始化并提交即可，不要提交到 `deepseek-harness`。
