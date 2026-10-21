/**
 * 右栏的第二个 Tab：命令面板。
 *
 * 它与用量面板是**两个 Tab、两个组件实例**，但共用 `usage-state.ts` 里的那一份数据，
 * 所以面板里「切到 30 日」会真的改到用量面板上，导出拿到的也是同一份汇总。
 *
 * 形态照 v4/v5 设计稿的右半边：品牌头 + 搜索框 + 分组命令列表 + 底栏。
 * 搜索框常驻（不跟着列表滚），列表自己滚——命令面板的第一动作永远是「打字」，
 * 输入框不能被滚出视野。
 *
 * 键位分两层：
 * - **全局唤出键**（⌘J / Ctrl+Alt+J）注册在宿主的快捷键目录里，键帽从那里读，
 *   与用户在设置里改过的绑定一致。
 * - **面板内加速键**（⌘1 / ⌘⇧J / ⌘E 之类）只在这个面板里生效，
 *   由本组件自己的 keydown 处理，不进宿主目录——免得跟宿主抢键。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { BrandHeader, BottomRule, Divider, StatusFooter, UsageBackdrop } from './UsageChrome.js'
import { TIMING, dropIn, fadeIn, riseIn } from './usage-motion.js'
import { formatCombo, matchesCombo, paletteKeycap, type Combo } from './usage-keys.js'
import {
  buildUsageCsv,
  buildUsageJson,
  copyToClipboard,
  downloadTextFile,
  fileStamp,
} from './usage-export.js'
import {
  clearUsage,
  ensureUsageLoaded,
  loadUsage,
  openUsagePanel,
  setUsageRange,
  useUsageState,
  type UsageRange,
} from './usage-state.js'
import { ACCENT, EDGE, FAINT, FONT_MONO, HAIR, MUTED, SURFACE, TEXT, rgba } from './usage-theme.js'

/** Props 由 slot 绑定与 locale 绑定组成，不要手工窄化。 */
export type UsageCommandsProps =
  PropsRuntime<'sidebar.right.pane.tab'>
  & PropsLocale<'dsh.usage'>

/** 面板里的一条命令。 */
interface PaletteCommand {
  /** 稳定标识。 */
  readonly id: string
  /** 显示名。 */
  readonly label: string
  /** 分组名（locale 文案）。 */
  readonly group: string
  /** 搜索关键词：小写、空格分隔。 */
  readonly keywords: string
  /** 面板内加速键。 */
  readonly combo?: Combo
  /** 执行动作。 */
  readonly run: () => void
  /** 当前不可用（例如还没有数据）。 */
  readonly disabled?: boolean
}

/** 列表内容最大宽度：命令面板是窄工具，宽屏上不摊开。 */
const LIST_MAX_WIDTH = 680

/**
 * 渲染命令面板。
 * @param props - slot 绑定的 tab 身份与 locale 文案。
 * @returns 面板内容。
 */
export function UsageCommands({ t }: UsageCommandsProps): ReactNode {
  const state = useUsageState()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const input = useRef<HTMLInputElement | null>(null)
  const list = useRef<HTMLDivElement | null>(null)
  const header = useRef<HTMLDivElement | null>(null)
  const search = useRef<HTMLDivElement | null>(null)
  const footer = useRef<HTMLDivElement | null>(null)

  useEffect(() => { ensureUsageLoaded() }, [])

  // 提示语停留一会儿就淡掉：它是一次性反馈，不该一直占着底栏。
  useEffect(() => {
    if (notice === undefined) return
    const timer = setTimeout(() => { setNotice(undefined) }, 2600)
    return () => { clearTimeout(timer) }
  }, [notice])

  // 每次请求聚焦（面板刚打开，或全局键再次唤出）都把光标交回搜索框。
  useEffect(() => {
    input.current?.focus()
  }, [state.focusRequest])

  const copyJson = useCallback(async () => {
    if (state.summary === undefined) {
      setNotice(t('palette.noData'))
      return
    }
    const ok = await copyToClipboard(buildUsageJson(state.summary))
    setNotice(ok ? t('palette.copied') : t('palette.copyFailed'))
  }, [state.summary, t])

  const exportCsv = useCallback(() => {
    if (state.summary === undefined) {
      setNotice(t('palette.noData'))
      return
    }
    const name = `dsh-usage-${fileStamp(state.summary.generatedAt)}.csv`
    const ok = downloadTextFile(name, buildUsageCsv(state.summary), 'text/csv;charset=utf-8')
    setNotice(ok ? t('palette.exported') : t('palette.exportFailed'))
  }, [state.summary, t])

  const commands = useMemo<readonly PaletteCommand[]>(() => [
    {
      id: 'usage.open',
      label: t('cmd.openUsage'),
      group: t('cmd.group.view'),
      keywords: 'usage dashboard 用量 面板 open',
      combo: { key: '1' },
      run: () => { openUsagePanel() },
    },
    {
      id: 'range.today',
      label: t('cmd.rangeToday'),
      group: t('cmd.group.window'),
      keywords: 'today 今日 window 窗口',
      combo: { key: '2' },
      run: () => { setUsageRange('today'); openUsagePanel() },
    },
    {
      id: 'range.d7',
      label: t('cmd.range7'),
      group: t('cmd.group.window'),
      keywords: '7 d7 week 7日 window 窗口',
      combo: { key: '3' },
      run: () => { setUsageRange('d7'); openUsagePanel() },
    },
    {
      id: 'range.d30',
      label: t('cmd.range30'),
      group: t('cmd.group.window'),
      keywords: '30 d30 month 30日 window 窗口',
      combo: { key: '4' },
      run: () => { setUsageRange('d30'); openUsagePanel() },
    },
    {
      id: 'data.copyJson',
      label: t('cmd.copyJson'),
      group: t('cmd.group.data'),
      keywords: 'copy json clipboard 复制 剪贴板',
      combo: { key: 'J', shift: true },
      run: () => { void copyJson() },
      disabled: state.summary === undefined,
    },
    {
      id: 'data.exportCsv',
      label: t('cmd.exportCsv'),
      group: t('cmd.group.data'),
      keywords: 'export csv download 导出 下载',
      combo: { key: 'E' },
      run: () => { exportCsv() },
      disabled: state.summary === undefined,
    },
    {
      id: 'data.refresh',
      label: t('cmd.refresh'),
      group: t('cmd.group.data'),
      keywords: 'refresh reload 刷新 重新读取',
      run: () => { void loadUsage() },
    },
    {
      id: 'data.clear',
      label: t('cmd.clear'),
      group: t('cmd.group.data'),
      keywords: 'clear reset 清空 清除',
      run: () => { void clearUsage() },
      disabled: state.clearing,
    },
  ], [copyJson, exportCsv, state.clearing, state.summary, t])

  const filtered = useMemo<readonly PaletteCommand[]>(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return commands
    return commands.filter((command) =>
      `${command.label} ${command.keywords}`.toLowerCase().includes(needle))
  }, [commands, query])

  // 命中列表变短时，选中项不能越界。
  useEffect(() => {
    setActive((previous) => (previous < filtered.length ? previous : 0))
  }, [filtered.length])

  /**
   * 执行一条命令。
   * @param command - 目标命令。
   */
  const run = useCallback((command: PaletteCommand) => {
    if (command.disabled === true) return
    command.run()
  }, [])

  /**
   * 搜索框上的按键处理：上下移动、回车执行、Esc 清空、加速键直达。
   * @param event - 键盘事件。
   */
  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const style = state.style
    for (const command of commands) {
      if (command.combo === undefined) continue
      if (!matchesCombo(style, command.combo, event)) continue
      event.preventDefault()
      setQuery('')
      run(command)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((previous) => (filtered.length === 0 ? 0 : (previous + 1) % filtered.length))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((previous) => (filtered.length === 0 ? 0 : (previous - 1 + filtered.length) % filtered.length))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const command = filtered[active]
      if (command !== undefined) run(command)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setQuery('')
    }
  }, [commands, filtered, run, state.style])

  // 选中项滚进视野：命令多的时候，键盘选到哪一条都要看得见。
  useEffect(() => {
    const box = list.current
    if (box === null) return
    const node = box.querySelector<HTMLElement>('[data-palette-active="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [active, filtered.length])

  const grouped = useMemo(() => {
    const groups: { title: string; items: { command: PaletteCommand; index: number }[] }[] = []
    filtered.forEach((command, index) => {
      const last = groups[groups.length - 1]
      if (last !== undefined && last.title === command.group) last.items.push({ command, index })
      else groups.push({ title: command.group, items: [{ command, index }] })
    })
    return groups
  }, [filtered])

  const paletteKey = paletteKeycap(state.style, state.paletteKeys)

  // 入场编排：品牌头、搜索框、命令列表、底栏依次落下。
  const played = useRef(false)
  useEffect(() => {
    if (played.current) return
    played.current = true
    dropIn(header.current, TIMING.compact.header)
    dropIn(search.current, TIMING.compact.tabs)
    riseIn(list.current, TIMING.compact.kpi)
    fadeIn(footer.current, TIMING.compact.footer)
  }, [])

  const statusText = notice !== undefined
    ? notice
    : `${t('footer.repo')} · ${state.status === 'ready' ? t('footer.synced') : t('state.loading')}`

  return (
    <section
      data-usage-palette=""
      style={{
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        height: '100%',
        maxHeight: '100%',
        background: SURFACE,
        color: TEXT,
        border: `1px solid ${EDGE}`,
        borderRadius: 14,
        padding: '14px 16px 14px',
        fontSize: 13,
        lineHeight: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <UsageBackdrop />

      <div ref={header} style={{ position: 'relative' }}>
        <BrandHeader
          title={t('brand.name')}
          usageLabel={t('brand.usage')}
          commandsLabel={t('brand.commands')}
          active="commands"
          onOpenUsage={() => { openUsagePanel() }}
        />
      </div>
      <Divider />

      <div ref={search} style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            borderRadius: 8,
            border: `1px solid ${EDGE}`,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <span aria-hidden="true" style={{ fontFamily: FONT_MONO, fontSize: 11, color: FAINT }}>⌕</span>
          <input
            ref={input}
            type="text"
            value={query}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
            onChange={(event) => { setQuery(event.target.value); setActive(0) }}
            onKeyDown={onKeyDown}
            style={{
              flex: 1,
              minWidth: 0,
              font: 'inherit',
              fontSize: 12,
              color: TEXT,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
            }}
          />
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              color: FAINT,
              border: `1px solid ${rgba(ACCENT, 0.3)}`,
              borderRadius: 4,
              padding: '2px 5px',
              flex: 'none',
            }}
          >
            {paletteKey}
          </span>
        </div>
      </div>

      <div
        ref={list}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
          maxWidth: LIST_MAX_WIDTH,
          margin: '0 auto',
        }}
      >
        {filtered.length === 0
          ? (
            <p style={{ margin: '12px 2px', fontSize: 12, color: MUTED }}>{t('palette.empty')}</p>
          )
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {grouped.map((group) => (
                <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 9,
                      fontWeight: 500,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: FAINT,
                      padding: '0 2px 4px',
                    }}
                  >
                    {group.title}
                  </span>
                  {group.items.map(({ command, index }) => {
                    const on = index === active
                    return (
                      <button
                        key={command.id}
                        type="button"
                        data-palette-active={on ? 'true' : 'false'}
                        data-palette-command={command.id}
                        disabled={command.disabled === true}
                        onMouseEnter={() => { setActive(index) }}
                        onClick={() => { run(command) }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          textAlign: 'left',
                          font: 'inherit',
                          fontSize: 12,
                          color: command.disabled === true ? FAINT : TEXT,
                          background: on ? rgba(ACCENT, 0.12) : 'transparent',
                          border: 'none',
                          borderLeft: `2px solid ${on ? ACCENT : 'transparent'}`,
                          borderRadius: 6,
                          padding: '7px 8px',
                          cursor: command.disabled === true ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {command.label}
                        </span>
                        {command.combo !== undefined && (
                          <span
                            style={{
                              fontFamily: FONT_MONO,
                              fontSize: 9,
                              letterSpacing: '0.04em',
                              color: on ? ACCENT : FAINT,
                              border: `1px solid ${on ? rgba(ACCENT, 0.35) : HAIR}`,
                              borderRadius: 4,
                              padding: '2px 5px',
                              flex: 'none',
                            }}
                          >
                            {formatCombo(state.style, command.combo)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
      </div>

      <BottomRule />
      <div ref={footer} style={{ position: 'relative' }}>
        <StatusFooter status={statusText} />
      </div>
    </section>
  )
}
