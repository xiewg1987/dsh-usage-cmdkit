/**
 * Web 浏览器半 — lazy-CJS factory（客户端模块系统要求的格式）。
 *
 * 由 scripts/build-client.mjs 从 src/client 生成；也可直接阅读本文件理解协议：
 *   window.__ModuleLoader__.load({ id: 包名, factory(require) { ... return { inject, apply } } })
 *
 * require() 只能解析平台模块表里的名字（react、@deepseek-ai/dsh-*），不能 require 本地相对路径。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin',
  factory(require) {
    const React = require('react')

    const NS = 'greetTool'
    const ROW_CONFIG_KEY = 'dsh-plugin#greet'

    const zh = {
      summary: '问候前缀与门禁名单',
      formAria: 'greet 工具配置',
      greeting: '问候前缀',
      greetingHint: 'execute 返回的前缀，例如 Hey →「Hey, Ada!」',
      preDeny: '执行前拒绝名单',
      preDenyHint: '逗号分隔。名单内的 name 在 pre-execute 被 deny，不跑 execute。',
      postBlock: '执行后拦截名单',
      postBlockHint: '逗号分隔。先跑完 execute，再在 post-execute 改成错误反馈。勿与上一栏重叠。',
      save: '保存',
      saving: '保存中…',
      unavailable: 'Host 尚未提供本行的可编辑配置（字段需 .volatile()）。',
      listHint: '每行一个名字，或用英文逗号分隔。',
    }
    const en = {
      summary: 'Greeting prefix and gate lists',
      formAria: 'greet tool configuration',
      greeting: 'Greeting prefix',
      greetingHint: 'Prefix for execute, e.g. Hey → "Hey, Ada!"',
      preDeny: 'Pre-execute deny list',
      preDenyHint: 'Comma-separated. Names here are denied before execute runs.',
      postBlock: 'Post-execute block list',
      postBlockHint: 'Comma-separated. execute runs first, then post-execute turns success into an error. Do not overlap the deny list.',
      save: 'Save',
      saving: 'Saving…',
      unavailable: 'Host is not serving an editable form for this row (fields need .volatile()).',
      listHint: 'One name per line, or comma-separated.',
    }

    function parseNameList(text) {
      return text.split(/[\n,]/).map((part) => part.trim()).filter((part) => part.length > 0)
    }

    function asStringList(value) {
      if (!Array.isArray(value)) return []
      return value.filter((item) => typeof item === 'string')
    }

    function GreetConfigCard({ t, view, form }) {
      const { useState } = React
      if (view === 'summary') return t('summary')
      if (form === undefined || form.state.status === 'unavailable' || form.state.value === undefined) {
        return React.createElement('p', null, t('unavailable'))
      }

      const value = form.state.value
      const [greeting, setGreeting] = useState(String(value.greeting ?? ''))
      const [preDeny, setPreDeny] = useState(asStringList(value.preDenyNames).join('\n'))
      const [postBlock, setPostBlock] = useState(asStringList(value.postBlockNames).join('\n'))
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(undefined)

      const disabled = !form.state.writable || busy || form.state.status !== 'ready'

      const onSubmit = (event) => {
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
        }, (err) => {
          setBusy(false)
          setError(err instanceof Error ? err.message : String(err))
        })
      }

      const field = (id, label, hint, fieldValue, onChange, multiline) => React.createElement(
        'label',
        { key: id, style: { display: 'grid', gap: 4, marginBottom: 12 } },
        React.createElement('span', { style: { fontWeight: 600 } }, label),
        React.createElement('span', { style: { opacity: 0.7, fontSize: 12 } }, hint),
        multiline
          ? React.createElement('textarea', {
            id,
            rows: 3,
            value: fieldValue,
            disabled,
            placeholder: t('listHint'),
            onChange: (event) => { onChange(event.currentTarget.value) },
          })
          : React.createElement('input', {
            id,
            type: 'text',
            value: fieldValue,
            disabled,
            onChange: (event) => { onChange(event.currentTarget.value) },
          }),
      )

      return React.createElement(
        'form',
        {
          'aria-label': t('formAria'),
          onSubmit,
          style: { display: 'grid', gap: 8, maxWidth: 480 },
        },
        field('greet-greeting', t('greeting'), t('greetingHint'), greeting, setGreeting, false),
        field('greet-pre-deny', t('preDeny'), t('preDenyHint'), preDeny, setPreDeny, true),
        field('greet-post-block', t('postBlock'), t('postBlockHint'), postBlock, setPostBlock, true),
        error === undefined ? null : React.createElement('p', { role: 'status', style: { color: 'crimson' } }, error),
        React.createElement('button', { type: 'submit', disabled }, busy ? t('saving') : t('save')),
      )
    }

    return {
      // 浏览器半 fiber 依赖：slots 挂 UI，locale 挂文案
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin: dictionaries')

        // 第三方行配置：key = 包名#行 id；bundle 开启且该行存在时才有 Configure
        ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
          name: 'plugins.row.config',
          key: ROW_CONFIG_KEY,
          locale: NS,
        }, (props) => GreetConfigCard({
          t,
          view: props.view,
          form: props.form,
        })))
      },
    }
  },
})
