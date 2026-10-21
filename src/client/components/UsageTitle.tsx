/**
 * 右栏 Tab 的标题。
 */
import type { ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

/** Props 由 slot 绑定与 locale 绑定组成。 */
export type UsageTitleProps =
  PropsRuntime<'sidebar.right.pane.tab.title'>
  & PropsLocale<'dsh.usage'>

/**
 * 渲染 Tab 标题。
 * @param props - slot 绑定的 tab 身份与 locale 文案。
 * @returns 用量面板的标题文本。
 */
export function UsageTitle({ t }: UsageTitleProps): ReactNode {
  return <span>{t('tab.title')}</span>
}
