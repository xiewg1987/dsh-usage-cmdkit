// 独立插件：注册 greet；门禁名单来自 Config；post-execute 改写；result 打日志。
//
// 源码联调（仅 Host / 工具逻辑）：
//   cd D:\ScriptProject\deepseek-harness
//   pnpm dsh web --patch ../dsh-plugin/patch.dev.yml
//
// Web 配置卡片（浏览器半）要求 Loader 行说明符是裸包名 `dsh-plugin`，
// 源码路径 `./src/hello-plugin.ts` 不会挂上 ./client。装进 profile 后联调：
//   dsh plugin --profile <name> add D:/ScriptProject/dsh-plugin
//   # 然后用带 web 的 profile 启动；Plugins → 本包 → greet 行 → Configure
import type { Context, Volatile } from '@deepseek-ai/cordis'
// 侧效应类型导入：把 loader/volatile-update 并入 Context 的 Events。
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { PostToolDecision, PreToolDecision, ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'
import Schema from '@deepseek-ai/schemastery'

/**
 * 插件 Config。字段用 Volatile 包一层，才能进 Web Plugins 页的即时表单：
 * - 普通字段只进 entry / patch，不会出现在 form.state
 * - `.volatile()` 的字段才会被 Host 暴露给浏览器半的 form.state / form.mutate
 */
export interface Config {
  greeting: Volatile<string>
  /** pre-execute deny：名单内的名字不跑 execute。 */
  preDenyNames: Volatile<string[]>
  /** post-execute block：先跑完 execute，再把成功改成错误反馈。 */
  postBlockNames: Volatile<string[]>
}

// Schemastery：加载时校验配置，缺省字段填默认值；.volatile() = 可被 Plugins 页改写。
// 不要写成 Schema<Config>：Volatile 接口与 schema 推断类型冲突（见 cookbook）。
export const Config = Schema.object({
  greeting: Schema.string().default('Hello').volatile(),
  preDenyNames: Schema.array(Schema.string()).default(['forbidden']).volatile(),
  postBlockNames: Schema.array(Schema.string()).default(['Ada5']).volatile(),
})

export const name = 'greet-tool'
// 等 ctx.tools 就绪后再执行 apply()。
export const inject = ['tools']

/**
 * 从策略层的参数里取出 name。
 *
 * 为什么需要这个函数：tools/pre-execute 里的 exec.arguments 类型是 unknown。
 * 这个钩子会拦所有工具，TypeScript 没法知道「这次一定是 greet，且有字符串 name」。
 * 所以要先收窄类型，再比较。
 *
 * 对比：下面 defineTool 的 execute(args) 里，args 已按该工具的 parameters 推断，
 * 可以直接写 args.name。
 */
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
  // Volatile 字段用 .get() 读取「当前」值。Web 卡片保存后会触发
  // loader/volatile-update；下次工具调用会读到新值，无需重挂插件。
  ctx.on('loader/volatile-update', () => {
    console.log(
      `[greet-tool] config updated: greeting=${config.greeting.get()} `
      + `preDeny=${JSON.stringify(config.preDenyNames.get())} `
      + `postBlock=${JSON.stringify(config.postBlockNames.get())}`,
    )
  })

  // 注册模型可调用的工具：名称/描述/参数进入提示词；
  // execute 返回规范值；render 把它变成给模型看的文本。
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: {
      name: { type: 'string', required: true, description: 'The name to greet' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      // 这里 args 已有类型：{ name: string }。greeting 来自 Config（Volatile）。
      return `${config.greeting.get()}, ${args.name}!`
    },
  }))

  // 工具真正执行前的 waterfall：可 allow / deny / ask / cancel。
  // 拒哪些名字由 config.preDenyNames 决定（见 patch / Web 卡片），不是源码硬编码。
  // next() = 交给后续策略链；想放行就必须调用它。
  ctx.on('tools/pre-execute', async (exec: ToolExecution, next): Promise<PreToolDecision> => {
    if (exec.name === 'greet' && nameInList(greetName(exec.arguments), config.preDenyNames.get())) {
      // 不调用 next()：短路，greet 的 execute 不会跑。
      return { kind: 'deny', reason: 'this name is blocked' }
    }
    // 放行本次调用，并继续后面的监听器。
    return next()
  })

  // 工具跑完（或 pre-execute deny 生成错误结果）之后的 waterfall。
  // postBlockNames：演示「先成功再 block」——名单不要和 preDenyNames 重叠，否则 execute 跑不到。
  // 可 accept（可替换 content 或 value）、block（改成错误反馈），或 next() 原样放行。
  // 这里改的是模型看到的工具结果（轨迹里可见），不是助手最终聊天气泡——那是模型另写的。
  ctx.on('tools/post-execute', async (exec: ToolExecution, result: ToolExecutionResult, next): Promise<PostToolDecision> => {
    if (exec.name === 'greet' && nameInList(greetName(exec.arguments), config.postBlockNames.get())) {
      return {
        kind: 'block',
        feedback: [{ type: 'text', text: `${String(result.value)} (post-execute block)` }],
      }
    } else if (exec.name === 'greet' && !result.isError) {
      // 不调用 next()：自己给出最终决策。只换 content，不换 value（二者不能同时换）。
      return {
        kind: 'accept',
        content: [{ type: 'text', text: `${String(result.value)} (post-execute ok)` }],
      }
    }
    // 其他工具或失败结果：交给后续监听器。
    return next()
  })

  // 流水线最后：结果已冻结，只观测（emit），不能改、也没有 next()。
  // 监听器抛错会被吞掉，不影响工具结果。打日志看运行 dsh 的终端，不进轨迹步骤。
  // 此时 content 已含 post-execute 的改写（若有），例如 "Hey, Ada4! (post-execute ok)"。
  ctx.on('tools/result', (exec, result) => {
    console.log(`[tool] ${exec.name}(${JSON.stringify(exec.arguments)})`)
    const text = result.content.map(block => block.type === 'text' ? block.text : '').join('')
    console.log(`[tool result] ${text.slice(0, 100)}`)
  })
}
