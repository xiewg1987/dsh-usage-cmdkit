/**
 * Web 专用配置卡片 UI（浏览器半）。
 *
 * 第三方组合包行应注册进 plugins.row.config（不是官方的 plugins.item）。
 * 页面所有者注入 form：{ state, mutate }；本组件只负责渲染与提交。
 */

import type { ConfigPageForm } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useState, type FormEvent, type ReactNode } from 'react'

/** Props 由 Plugins 页 + locale 绑定组成，不要自造 ConfigPageForm。 */
export type GreetConfigCardProps =
  PropsRuntime<'plugins.row.config'>
  & PropsLocale<'greetTool'>

/** 把「一行一个 / 逗号分隔」的文本解析成 string[]。 */
function parseNameList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map(part => part.trim())
    .filter(part => part.length > 0)
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/**
 * summary → 卡片/缺描述时的一行摘要；
 * page → 带保存的表单（离开页面会丢弃未保存草稿，由 Plugins 页约定）。
 */
export function GreetConfigCard(props: GreetConfigCardProps): ReactNode {
  const { t, view, form } = props

  if (view === 'summary') return t('summary')
  if (form === undefined || form.state.status === 'unavailable' || form.state.value === undefined) {
    return <p>{t('unavailable')}</p>
  }

  return <GreetConfigForm t={t} form={form} />
}

function GreetConfigForm(props: {
  t: GreetConfigCardProps['t']
  form: ConfigPageForm
}) {
  const { t, form } = props
  const value = form.state.value ?? {}
  const [greeting, setGreeting] = useState(String(value.greeting ?? ''))
  const [preDeny, setPreDeny] = useState(asStringList(value.preDenyNames).join('\n'))
  const [postBlock, setPostBlock] = useState(asStringList(value.postBlockNames).join('\n'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const disabled = !form.state.writable || busy || form.state.status !== 'ready'

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    void form.mutate(
      [
        { op: 'set', path: ['greeting'], value: greeting },
        { op: 'set', path: ['preDenyNames'], value: parseNameList(preDeny) },
        { op: 'set', path: ['postBlockNames'], value: parseNameList(postBlock) },
      ],
      form.state.revision,
    ).then((ok) => {
      setBusy(false)
      if (!ok) setError('save rejected (revision conflict or validation)')
    }, (err: unknown) => {
      setBusy(false)
      setError(err instanceof Error ? err.message : String(err))
    })
  }

  return (
    <form
      aria-label={t('formAria')}
      onSubmit={onSubmit}
      style={{ display: 'grid', gap: 8, maxWidth: 480 }}
    >
      <label style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
        <span style={{ fontWeight: 600 }}>{t('greeting')}</span>
        <span style={{ opacity: 0.7, fontSize: 12 }}>{t('greetingHint')}</span>
        <input
          id="greet-greeting"
          type="text"
          value={greeting}
          disabled={disabled}
          onChange={(event) => { setGreeting(event.currentTarget.value) }}
        />
      </label>

      <label style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
        <span style={{ fontWeight: 600 }}>{t('preDeny')}</span>
        <span style={{ opacity: 0.7, fontSize: 12 }}>{t('preDenyHint')}</span>
        <textarea
          id="greet-pre-deny"
          rows={3}
          value={preDeny}
          disabled={disabled}
          placeholder={t('listHint')}
          onChange={(event) => { setPreDeny(event.currentTarget.value) }}
        />
      </label>

      <label style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
        <span style={{ fontWeight: 600 }}>{t('postBlock')}</span>
        <span style={{ opacity: 0.7, fontSize: 12 }}>{t('postBlockHint')}</span>
        <textarea
          id="greet-post-block"
          rows={3}
          value={postBlock}
          disabled={disabled}
          placeholder={t('listHint')}
          onChange={(event) => { setPostBlock(event.currentTarget.value) }}
        />
      </label>

      {error === undefined ? null : (
        <p role="status" style={{ color: 'crimson' }}>{error}</p>
      )}

      <button type="submit" disabled={disabled}>
        {busy ? t('saving') : t('save')}
      </button>
    </form>
  )
}
