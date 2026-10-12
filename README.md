# dsh-plugin

独立 DeepSeek Harness 插件仓库（可长期开发与提交）。从 `deepseek-harness/scratch-plugin` 迁出。

## 布局

| 文件 | 用途 |
|------|------|
| `src/hello-plugin.ts` | Host 半：`greet` 工具 + Volatile Config 门禁 + post/result 钩子 |
| `src/client/` | 浏览器半源码草图（注释与类型；`plugins.row.config` 卡片） |
| `lib/client.js` | Web 实际加载的 lazy-CJS factory（`exports["./client"]`） |
| `patch.dev.yml` | 源码联调 Host：`pnpm dsh web --patch`（**不**挂 client） |
| `cordis.patch.yml` | 组合包层：`dsh plugin add` / profile（裸包名，**会**挂 client） |
| `package.json` | `dsh.bundle` + `dsh.client.platform: "web"` |

## 源码联调 Host（旁路 harness）

```sh
cd D:\ScriptProject\dsh-plugin
pnpm install

cd D:\ScriptProject\deepseek-harness
pnpm dsh web --patch ../dsh-plugin/patch.dev.yml
```

改 Host `src/` 或 `patch.dev.yml` 一般会 HMR。这条路径**不会**加载 Web 配置卡片。

## Web 配置卡片（浏览器半）

第三方行配置注册在 `plugins.row.config`，键为 `dsh-plugin#greet`。

1. Host Config 字段必须 `.volatile()`，否则 Plugins 页没有 `form`。
2. `package.json` 声明 `exports["./client"]` 与 `dsh.client.platform: "web"`。
3. Loader 行说明符必须是裸包名 `dsh-plugin`（见 `cordis.patch.yml`），子路径/源码路径不挂 client。

```sh
dsh plugin --profile mydemo add D:/ScriptProject/dsh-plugin
# 用带 Web 的 profile 启动后：
# Plugins → dsh-plugin → greet 行 → Configure
```

改卡片 UI：编辑 `src/client/`（说明）并同步 `lib/client.js`，然后 `pnpm run build:client`。装进 profile 后若 client 已缓存，重启 Web 或 bump 包版本。

## 门禁配置

编辑 patch 的 `config`，或在 Web 卡片里保存：

- `preDenyNames`：执行前 deny（不跑 `execute`）
- `postBlockNames`：执行后 block（先跑成功再改成错误）；勿与 `preDenyNames` 重叠
- `greeting`：问候前缀

## Git

在本目录初始化并提交即可，不要提交到 `deepseek-harness`。
