# Client 半学习路线（从零）

Host 只保留 **最小 Config**（`src/index.ts`），**不写 React**。  
所有界面在 **`src/client/`**（React TSX），产物 **`lib/client.js`**。

## 你要产出的东西

Plugins 页 → **dsh-plugin** → 行 **ui-demo** → **Configure** → 一张配置表单（改 `panelTitle` / `showHelperBanner`）。

槽位键：**`dsh-plugin#ui-demo`**（包名 + patch 行 id）。

## Step 0 — 环境

```powershell
cd D:\ScriptProject\dsh-plugin
pnpm install
pnpm run typecheck
```

## Step 1 — 只确认 Host（可选）

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh web --patch ../dsh-plugin/patch.dev.yml
```

终端里改 Config 不会自动出现；这步只确认 Host 能加载。**看不到配置卡是正常的**。

## Step 2 — 建 `src/client/`（React）

对照 **`archive/greet-lab/src/client/`**，在本仓库新建：

| 文件 | 作用 |
|------|------|
| `src/client/index.ts` | `inject: ['slots','locale']`，注册 `plugins.row.config` |
| `src/client/UiConfigCard.tsx` | 表单 UI，`form.state` / `form.mutate` |
| `src/client/locales.ts` | 中英文文案 |

键名改为 **`dsh-plugin#ui-demo`**，locale 命名空间自定（如 `uiDemo`）。

类型：只 **type-only** 导入 `@deepseek-ai/dsh-client-*`，不要从 client 包 import 值（bundle 门禁）。

## Step 3 — 构建 `lib/client.js`

复制并改路径：`archive/greet-lab/scripts/build-client.mjs` → 仓库根 `scripts/`，然后：

```powershell
pnpm run build:client
```

`package.json` 已声明 `exports["./client"]` 与 `dsh.client.platform: "web"`。

## Step 4 — 用 profile 看 UI（必须）

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh plugin --profile web add D:/ScriptProject/dsh-plugin
pnpm dsh web
```

**不要**与 `--patch` 同一次启动混用。  
Plugins → Configure → 保存后看 Host 终端 `[ui-demo] config:` 日志。

## Step 5 — 验收

- [ ] Configure 出现表单，不是 unavailable  
- [ ] 保存后 Host log 里 Config 更新  
- [ ] `pnpm run typecheck` 通过  

## 进阶（以后）

- 右栏新 tab：`ui-sidebar-right` 的 `sidebarRightTabs` + `sidebar.right.pane.tab`（仍是 Client 半）  
- 仍不做笔记工具 / LLM 工具链  

## 参考

- 完整样本：`archive/greet-lab/`  
- 封存快照：`archive/pre-client-learning-2026-10-13/`  
- Host/Web：`docs/01-overview.md`  
- greet 对照：`docs/04-reference-archived-greet.md`
