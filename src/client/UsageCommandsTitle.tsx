/**
 * 命令面板 Tab 的标题。
 */
import type { ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

/** Props 由 slot 绑定与 locale 绑定组成。 */
export type UsageCommandsTitleProps =
  PropsRuntime<'sidebar.right.pane.tab.title'>
  & PropsLocale<'dsh.usage'>

/**
 * 渲染命令面板 Tab 的标题。
 * @param props - slot 绑定的 tab 身份与 locale 文案。
 * @returns 标题文本。
 */
export function UsageCommandsTitle({ t }: UsageCommandsTitleProps): ReactNode {
  return <span>{t('tab.commands')}</span>
}
