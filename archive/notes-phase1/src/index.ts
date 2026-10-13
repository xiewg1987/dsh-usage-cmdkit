/**
 * 方案 A：本地短笔记 — Host 入口。
 *
 * 默认把笔记写在「当前对话所在工作区」下（与侧栏绑定目录 / Session cwd 一致），
 * 每人、每个工作区不同，无需在 patch 里写 D:\...。
 *
 * Config.storagePath：
 *   - 默认 `notes.txt` → 工作区根目录下的 notes.txt
 *   - 相对路径 → 相对当前会话 cwd
 *   - 绝对路径 → 固定位置（高级用法）
 */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { PreToolDecision, ToolExecution, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { } from '@deepseek-ai/cordis-plugin-loader'
import Schema from '@deepseek-ai/schemastery'
import fs from 'fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Config {
  /** 工作区内的相对路径或绝对路径；默认仅文件名，落在绑定目录根下。 */
  storagePath: Volatile<string>
  defaultLimit: Volatile<number>
  maxNotes: Volatile<number>
}

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const Config = Schema.object({
  storagePath: Schema.string().default('notes.txt').volatile(),
  defaultLimit: Schema.number().default(3).volatile(),
  maxNotes: Schema.number().default(5).volatile(),
})

export const name = 'notes'
export const inject = ['tools']

/**
 * 解析笔记文件绝对路径：优先当前会话工作区（绑定目录），无 cwd 时退回插件 data/。
 */
function resolveNotesPath(config: Config, exec: ToolRunContext): string {
  const raw = config.storagePath.get().trim() || 'notes.txt'
  if (path.isAbsolute(raw)) return raw

  const cwd = exec.agent?.session.header.cwd
  if (cwd !== undefined) return path.resolve(cwd, raw)

  return path.resolve(pluginRoot, 'data', path.basename(raw))
}

// 获取笔记内容
function noteAddText(args: unknown): string | undefined {
  if (typeof args !== 'object' || args === null || !('text' in args)) return undefined
  const { text } = args
  return typeof text === 'string' ? text : undefined
}

export function apply(ctx: Context, config: Config): void {
  ctx.tools.register(defineTool({
    name: 'note_add',
    description: '稍后保存一条简短的备注',
    parameters: {
      text: { type: 'string', required: true, description: '要保存的笔记内容' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const notesPath = resolveNotesPath(config, exec)
      if (fs.existsSync(notesPath)) {
        const items = fs.readFileSync(notesPath, 'utf8')
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean)
        if (items.length >= config.maxNotes.get()) {
          return `笔记数量超过最大限制（最大限制: ${config.maxNotes.get()}）`
        }
      }
      fs.mkdirSync(path.dirname(notesPath), { recursive: true })
      fs.appendFileSync(notesPath, `${args.text}\n`)
      const cwd = exec.agent?.session.header.cwd
      const hint = cwd === undefined
        ? '（当前会话无工作区 cwd，已写入插件 data/ 回退路径）'
        : ''
      return `笔记已保存: ${notesPath}${hint}`
    },
  }))
  ctx.tools.register(defineTool({
    name: 'note_list',
    description: '列出最近保存的笔记',
    parameters: {
      limit: { type: 'number', description: '读取笔记的内容' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const notesPath = resolveNotesPath(config, exec)
      if (!fs.existsSync(notesPath)) {
        return `暂无笔记（文件: ${notesPath}）`
      }
      const limit = args.limit ?? config.defaultLimit.get()
      const lines = fs.readFileSync(notesPath, 'utf8').split('\n').slice(-limit)
      return `笔记已列出: ${lines.join('\n')}`
    },
  }))
  ctx.on('tools/pre-execute', async (exec: ToolExecution, next): Promise<PreToolDecision> => {
    if (exec.name === 'note_add') {
      const text = noteAddText(exec.arguments)
      if (text === undefined || text.trim().length === 0) {
        return { kind: 'deny', reason: '笔记内容不能为空' }
      }
    }
    return next()
  })
}
