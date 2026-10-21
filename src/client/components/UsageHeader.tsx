/**
 * 面板的头部：品牌行 + 发丝线 + 控件行。
 *
 * 三块内容都在这儿，因为它**三屏共用**：
 * 总览、Top、告警换的是身体，头永远一样——
 * 用户在告警屏和总览屏之间来回切，头不该跳一下。
 *
 * 控件行有两套控件：左边视图分段、右边时间窗药丸。
 * 两套都用「描边 = 选中」的语言（分段控件里是冷青描边，
 * 时间窗药丸里是灰/青描边），放一行才不会打架。
 *
 * 组件自己不绑 locale：`t` 由调用方传进来。
 */
import type { ReactNode } from 'react'
import { BrandHeader, WindowPills } from './UsageChrome.js'
import { SegmentedControl } from './UsageMeters.js'
import { ACCENT_CYAN, HAIRLINE } from '../theme/usage-theme.js'
import type { UsageTranslate } from '../i18n/locales.js'

/** 面板的三个视图。 */
export type UsageView = 'overview' | 'top' | 'alerts'

/** 三个视图的顺序：分段控件的下标与它一一对应。 */
export const USAGE_VIEWS: readonly UsageView[] = ['overview', 'top', 'alerts']

/** 面板头部的属性。 */
export interface UsageHeaderProps {
  /** 翻译函数。 */
  t: UsageTranslate
  /** 视图分段文案（总览 / Top / 告警）。 */
  views: readonly string[]
  /** 当前视图的下标。 */
  active: number
  /** 切视图。 */
  onView: (index: number) => void
  /** 时间窗可选项。 */
  windows: readonly { value: string; label: string }[]
  /** 当前时间窗。 */
  windowValue: string
  /** 切时间窗。 */
  onWindow: (value: string) => void
  /** 品牌行的字号档位：窄栏用紧凑版。 */
  brandSize?: 'normal' | 'compact'
  /** 时间窗药丸的字号档位。 */
  pillSize?: 'normal' | 'compact'
  /** 强调色，默认蓝青。 */
  accent?: string
}

/**
 * 渲染面板头部。
 * @param props - 视图、时间窗与文案。
 * @returns 头部。
 */
export function UsageHeader(props: UsageHeaderProps): ReactNode {
  const { t, views, active, onView, windows, windowValue, onWindow } = props
  const accent = props.accent ?? ACCENT_CYAN
  return (
    <>
      <BrandHeader
        title={t('brand.name')}
        usageLabel={t('brand.usage')}
        accent={accent}
        size={props.brandSize ?? 'normal'}
      />
      <div aria-hidden="true" style={{ height: 1, background: HAIRLINE, flex: 'none' }} />
      {/* 控件行：视图分段 + 时间窗药丸。窄屏放不下就换行。 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <SegmentedControl items={views} active={active} onSelect={onView} accent={accent} />
        <div style={{ marginLeft: 'auto' }}>
          <WindowPills
            items={windows.map((item) => ({ value: item.value, label: item.label }))}
            value={windowValue}
            onSelect={onWindow}
            accent={accent}
            size={props.pillSize ?? 'normal'}
          />
        </div>
      </div>
    </>
  )
}
