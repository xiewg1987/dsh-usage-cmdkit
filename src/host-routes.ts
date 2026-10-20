/**
 * Host 侧的用量路由。
 *
 * 为什么是**自定义路由**而不是官方 remote：harness 的 `ctx.remote.<namespace>`
 * 由 `@deepseek-ai/dsh-api-remotes` 客户端装配静态挂载（该包是 harness 内部包，
 * 第三方插件无法把自己的 namespace 加进那份清单），而 remote 客户端还要求
 * typert 生成的 `lib/typert.remote-client.*` 产物。
 *
 * 第三方插件可用的通道是 `ctx.connection.fetch.register`：在 Connection 的
 * 认证栅栏内注册一条精确路由，浏览器用同源 `fetch` 直接读，
 * Host/Origin 检查与浏览器会话 cookie 由 Connection 统一处理。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { USAGE_CLEAR_PATH, USAGE_SUMMARY_PATH } from './protocol.js'
import { clearUsage, readUsageSummary } from './usage-store.js'

/** 汇总与清空响应都不应被任何中间缓存。 */
const NO_STORE = { 'cache-control': 'no-store' } as const

/**
 * 在 Connection 的认证通道里注册用量路由。
 *
 * 路由挂在 `/api` 共享通道下，因此会经过与官方 remote 相同的
 * Host/Origin 栅栏与浏览器会话鉴权。
 * @param ctx - Host 上下文。
 */
export function registerUsageRoutes(ctx: Context): void {
  ctx.connection.fetch.register({
    path: USAGE_SUMMARY_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: () => readUsageSummary().then(
      summary => Response.json(summary, { headers: NO_STORE }),
      (error: unknown) => {
        console.error('[dsh-usage-cmdkit] 读取用量汇总失败', error)
        return new Response('usage summary unavailable', { status: 500 })
      },
    ),
  })

  ctx.connection.fetch.register({
    path: USAGE_CLEAR_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: () => clearUsage().then(
      () => Response.json({ cleared: true }, { headers: NO_STORE }),
      (error: unknown) => {
        console.error('[dsh-usage-cmdkit] 清空用量失败', error)
        return new Response('usage clear failed', { status: 500 })
      },
    ),
  })
}
