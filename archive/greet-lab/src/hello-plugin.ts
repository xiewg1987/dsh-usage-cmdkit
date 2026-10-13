// 独立插件：注册 greet；门禁名单来自 Config；post-execute 改写；result 打日志。
//
// ─── 先读这段：什么叫「改结果」─────────────────────────────────────────────
//
// 一次 greet 调用会产生两样你在界面上能看到的东西：
//
//   A. 工具结果（轨迹里的 tool 输出）
//      流水线：execute → render → post-execute → result
//      例：execute 算出 "Hey, Ada!"
//          post-execute 可以把它整段换成别的字（见下面 accept 分支）
//      ★ 这就是钩子能改的「结果」。post-execute 就是干这个的，没有第三套 API。
//
//   B. 助手聊天气泡（模型看完 A 之后自己写的话）
//      例：模型再说「已经帮你打过招呼了」
//      ★ 任何 tools/* 钩子都改不了 B，只能改 A，从而间接影响模型怎么写 B。
//
// 以前示例在 A 后面加 "(post-execute ok)"，看起来像「只是追加」，容易误解。
// 下面改成「整段替换」，跑一次就能看出：轨迹里的字已经不是 execute 的原文了。
//
// 源码联调（仅 Host）：
//   cd D:\ScriptProject\deepseek-harness
//   pnpm dsh web --patch ../dsh-plugin/patch.dev.yml
//
// Web 配置卡片：dsh plugin --profile web add D:/ScriptProject/dsh-plugin
//   再 pnpm dsh web（不要 --patch）→ Plugins → dsh-plugin → greet → Configure
import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { PostToolDecision, PreToolDecision, ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'
import Schema from '@deepseek-ai/schemastery'

/**
 * 插件 Config。字段用 Volatile 包一层，才能进 Web Plugins 页的即时表单。
 */
export interface Config {
  greeting: Volatile<string>
  /** pre-execute deny：名单内的名字不跑 execute。 */
  preDenyNames: Volatile<string[]>
  /** post-execute block：先跑完 execute，再把成功改成错误反馈。 */
  postBlockNames: Volatile<string[]>
}

export const Config = Schema.object({
  greeting: Schema.string().default('Hello').volatile(),
  preDenyNames: Schema.array(Schema.string()).default(['forbidden']).volatile(),
  postBlockNames: Schema.array(Schema.string()).default(['Ada5']).volatile(),
})

export const name = 'greet-tool'
export const inject = ['tools']

function greetName(args: unknown): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined
  if (!('name' in args)) return undefined
  const { name } = args
  return typeof name === 'string' ? name : undefined
}

function nameInList(name: string | undefined, list: readonly string[]): boolean {
  return name !== undefined && list.includes(name)
}

export function apply(ctx: Context, config: Config) {
  ctx.on('loader/volatile-update', () => {
    console.log(
      `[greet-tool] config updated: greeting=${config.greeting.get()} `
      + `preDeny=${JSON.stringify(config.preDenyNames.get())} `
      + `postBlock=${JSON.stringify(config.postBlockNames.get())}`,
    )
  })

  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: {
      name: { type: 'string', required: true, description: 'The name to greet' },
    },
    output: {
      schema: { type: 'string' },
      // render：把 execute 的 value 变成「默认」给模型看的文本。
      // 若后面 post-execute 换了 content，模型最终看到的是换过后的，不是这里。
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      // 规范值（value）。终端里若只跑到这里，会是 "Hey, Ada!" 这种。
      return `${config.greeting.get()}, ${args.name}!`
    },
  }))

  // ① 执行前：能否跑 execute
  ctx.on('tools/pre-execute', async (exec: ToolExecution, next): Promise<PreToolDecision> => {
    if (exec.name === 'greet' && nameInList(greetName(exec.arguments), config.preDenyNames.get())) {
      // deny → 没有 execute，轨迹里是拒绝原因（也是一种工具侧结果）
      return { kind: 'deny', reason: 'this name is blocked' }
    }
    return next()
  })

  // ② 执行后：改「工具结果」A（模型在轨迹里看到的那一段）
  //    名单不要和 preDenyNames 重叠，否则 execute 跑不到，也就没有成功结果可改。
  ctx.on('tools/post-execute', async (exec: ToolExecution, result: ToolExecutionResult, next): Promise<PostToolDecision> => {
    if (exec.name !== 'greet') return next()

    const original = String(result.value ?? '')

    // block：仍算「改了工具结果」——改成错误反馈，模型看到的是失败而不是成功问候
    if (nameInList(greetName(exec.arguments), config.postBlockNames.get())) {
      return {
        kind: 'block',
        feedback: [{
          type: 'text',
          text: `【post-execute 拦截】execute 已经算出「${original}」，但策略把它改成了错误。`,
        }],
      }
    }

    if (!result.isError) {
      // accept + 换 content = 整段替换工具结果（不是在后面加点字）
      // 试：greet Ada7 → 轨迹里应是下面这句，而不是 "Hey, Ada7!"
      // value 仍保持 original（二者不能同时换）；模型读的是 content。
      return {
        kind: 'accept',
        content: [{
          type: 'text',
          text: `【post-execute 已整段替换】execute 原文是「${original}」，模型现在看到的是这句话。`,
        }],
      }
    }

    return next()
  })

  // ③ 冻结之后：只能看 A 的最终 content，不能再改
  ctx.on('tools/result', (exec, result) => {
    console.log(`[tool] ${exec.name}(${JSON.stringify(exec.arguments)})`)
    const text = result.content.map(block => block.type === 'text' ? block.text : '').join('')
    // 成功路径这里应打印「【post-execute 已整段替换】…」，证明 A 已被改写
    console.log(`[tool result] ${text.slice(0, 120)}`)
  })
}
