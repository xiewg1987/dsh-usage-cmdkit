# 封存对照：greet 实验

路径：`archive/greet-lab/`。

## 当时练了什么

| 点 | 位置（归档内） |
|----|----------------|
| greet 工具 + Volatile Config | `src/hello-plugin.ts` |
| pre-deny / post-block | 同上 `ctx.on('tools/…')` |
| Web 配置卡草稿 | `src/client/` + 手写 `lib/client.js` |
| 槽位键 | `plugins.row.config` → `dsh-plugin#greet` |

## 重要结论（避免再踩坑）

1. **工具结果 ≠ 助手气泡**；改 `post-execute` 的 `content` 改的是轨迹里的工具输出。  
2. Content 块用 `type: 'text'`；没有 `html`；Markdown 写在 `text` 字符串里。  
3. `lib/client.js` 曾是手写捷径，正规应 `src/client` 打包生成；方案 A 可先不做 client。  
4. 现网请在仓库根 `src/` 实现笔记，不要在 `archive/` 里继续开发。
