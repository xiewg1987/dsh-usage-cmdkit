# 练习：Web UI 插件（Plugins 配置卡）

**不再做笔记工具。** 笔记 Phase 1 已封存于 `archive/notes-phase1/`；本练习专注 **浏览器半 + Volatile Config**，**不依赖**模型调用 `note_add` 等工具。

## 为什么选 UI 类

| Host 工具插件 | Client UI 插件 |
|---------------|----------------|
| 用户说话 → 模型决定是否调工具 → 轨迹里看结果 | 用户在 **Plugins → 你的插件行 → Configure** 里点选、输入、保存 |
| 入参/出参和模型强相关 | 入参/出参主要是 **`form.state` / `form.mutate`** 与 Host **`config.xxx.get()`** |
| 容易感觉「一直在和 LLM 交涉」 | 联调重点是 **Web 表单是否出现、保存是否热更新** |

UI 练习仍可以 **零工具**：Host 只导出 `Config` + `apply`，不写 `defineTool`。

## 目标（建议分步）

### Step 1 — Host：可被表单编辑的 Config

在 `src/index.ts`：

- `Schema.object` + 至少 2 个 **`.volatile()`** 字段（例如 `panelTitle: string`、`showHelperBanner: boolean`）。
- `apply(ctx, config)`：可选 `loader/volatile-update` 里 `console.log` 验证保存后 Host 能读到新值。
- **不要**注册 `note_add` / 任何工具（本练习与 LLM 无关）。

### Step 2 — Client：Plugins 行配置卡

对照 `archive/greet-lab/src/client/`：

- 槽位：`plugins.row.config`，键 **`dsh-plugin#<patch 行 id>`**（当前 id 建议 `ui-demo` → `dsh-plugin#ui-demo`）。
- 组件：`form.state.value` 展示字段，`form.mutate` 保存（revision 冲突要处理，见 greet 卡片）。
- 需要恢复 `package.json` 的 `./client` export、`dsh.client.platform: "web"`、React 相关 devDependencies（可从 `archive/greet-lab/package.json.snapshot` 抄版本）。

### Step 3 — 加载方式（重要）

| 方式 | 能否看到配置卡 |
|------|----------------|
| `pnpm dsh web --patch ../dsh-plugin/patch.dev.yml`（源码路径） | **通常不能**（不挂 client 半） |
| `pnpm dsh plugin --profile web add D:/ScriptProject/dsh-plugin` 再 `pnpm dsh web` | **可以**（裸包名 `dsh-plugin` + `lib/client.js` 或官方 client 流水线） |

greet 归档里写得很清楚：`patch.dev.yml` 的 `name: './src/...'` **不会**加载 `./client`。

### Step 4 — 构建 client（与 greet 相同套路）

- 源码：`src/client/`（TSX 卡片 + `locales`）。
- 产物：`lib/client.js`（lazy-CJS factory），或按 harness 文档跑 `build:client` 脚本（见 `archive/greet-lab/scripts/build-client.mjs`）。

## 验收清单

- [ ] Host：`pnpm run typecheck` 通过；Volatile 字段在 Schema 中  
- [ ] `plugin add` + `pnpm dsh web` 后，Plugins 列表有 **dsh-plugin** / 行 **ui-demo**  
- [ ] 点 **Configure** 出现你的表单，不是「Host 尚未提供 form」  
- [ ] 改字段并保存 → Host 终端（若打了 log）或下次读 `config.xxx.get()` 已是新值  
- [ ] （可选）加一个 **只读** Host 工具 `ui_ping` 返回 Config 摘要，**仅**用于验证热更新，不当作产品能力  

## 明确不做

- 笔记、工作区写文件（已封存）  
- 整页对话换肤、桌宠  
- 依赖模型「理解」你的 UI  

## 参考

- 封存 greet（完整 Host+Client 样本）：`archive/greet-lab/`  
- harness：`docs/cookbook/adding-a-settings-card.zh.md`  
- Host/Web 边界：`docs/01-overview.md`  
- 联调命令：`docs/03-dev-workflow.md`（需补充「plugin add 测 UI」一节时你自己加）
