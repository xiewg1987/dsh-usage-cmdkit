/**
 * 3D 用量环：等高线层环的 React 外壳。
 *
 * 分工很明确——**图是 3D 的，文字是普通的**：
 * - 环本身画在 canvas 上（three.js），带倾斜、层叠与慢自转；
 * - 环心的总览数字、环外的百分比标签都是普通 DOM 文字，
 *   叠在 canvas 上面，不随透视变形：小字在倾斜下会发虚，数据面板不能这样。
 *
 * 降级链（按顺序）：
 * 1. 拿不到 WebGL（虚拟机 / 远程桌面 / 禁硬件加速）→ 直接用 SVG 环，功能一条不少。
 * 2. three 加载或建场失败 → 同样退回 SVG 环。
 * 3. 运行中 `webglcontextlost` → 立刻切回 SVG 环；上下文恢复后自动切回 3D。
 *
 * 三个动态 import 的边界：three.js 是整包内联进产物的（宿主模块表里没有 3D 库），
 * 所以这段代码要等真正要用 3D 时才执行，别在模块顶层 import。
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { UsageRing, RING_VARIANT, type UsageRingProps } from './UsageRing.js'
import { ACCENT, BUCKET_COLORS, FONT_SANS, MUTED, TEXT } from './usage-theme.js'
import { useCountUp } from './usage-motion.js'
import { placeRingLabels, ringSegments, type RingLabelPlacement, type RingSegment } from './usage-ring-geometry.js'
import type { ContourRing } from './usage-3d.js'

/**
 * 3D 分片的包内 id。
 *
 * three.js 有 ~510KB，不能进首屏产物。宿主支持**包内动态分片**：
 * factory 里的 `require('./client.xxx.js')` 会被外壳当成包内分片去取
 * （`packages/client/modules/src/client/system.ts` 的 `importChunk`），
 * 分片名必须匹配 `client.<名字>.js`。
 *
 * 这个 `require` 是宿主 factory 注入的参数，不是 Node 的 require——
 * 所以要用它取分片，不能用普通的 `import()`（那会按页面相对路径去找，找不到）。
 */
const CHUNK_ID = './client.usage3d.js'

/** 3D 模块的形状（类型来自源码，运行时本体在分片里）。 */
type RingModule = typeof import('./usage-3d.js')

/**
 * 宿主 factory 注入的 require。
 *
 * 分片入口是 `require.async(spec)`，不是同步的 `require(spec)`：
 * 同步 require 只认模块表里的种子词与已物化的模块，分片得走 async 那条。
 */
interface ChunkRequire {
  async?: (spec: string) => Promise<unknown>
}

/**
 * 取 3D 分片。
 * @returns 3D 模块。
 */
async function loadRingModule(): Promise<RingModule> {
  const loader = require as unknown as ChunkRequire
  if (typeof loader.async !== 'function') throw new Error('包内分片加载器不可用')
  return await loader.async(CHUNK_ID) as RingModule
}

/**
 * 这个浏览器能不能开 WebGL。
 *
 * 探针用的是一次性画布，并且主动把上下文丢掉：
 * 不能白占一个上下文位（浏览器同时可用的上下文有限），
 * 也不能让它影响真正要用的那个画布。
 * @returns 是否支持 WebGL。
 */
function webglSupported(): boolean {
  try {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl')
    if (gl === null) return false
    const release = gl.getExtension('WEBGL_lose_context')
    release?.loseContext()
    return true
  } catch {
    return false
  }
}

/**
 * 渲染 3D 用量环。
 * @param props - 与 SVG 环同一套属性。
 * @returns 3D 环（不可用时是 SVG 环）。
 */
export function UsageRing3D(props: UsageRingProps): ReactNode {
  const { buckets, total, format, caption, captionAccent, sub, size, variant, labels, timing } = props
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  /** 降级：拿不到 WebGL 或上下文丢了，就用 SVG 环。 */
  const [degraded, setDegraded] = useState(false)
  const ringRef = useRef<ContourRing | null>(null)
  const labelNodes = useRef<(HTMLSpanElement | null)[]>([])
  const placementsRef = useRef<RingLabelPlacement[]>([])
  const segmentsRef = useRef<RingSegment[]>([])
  const sizeRef = useRef(size)

  const segments = useMemo(() => ringSegments(buckets), [buckets])
  const placements = placeRingLabels(segments, labels ?? [])
  segmentsRef.current = segments
  placementsRef.current = placements
  sizeRef.current = size

  /**
   * 把环外标签摆到环上。
   *
   * 标签跟着弧走：环在自转，标签就用投影算出来的实时位置跟着转，
   * 不会和弧段脱节。位置是直接写 style，不走 React 状态——
   * 每秒二十次的状态更新不值得。
   */
  const positionLabels = (): void => {
    const ring = ringRef.current
    if (ring === null) return
    const current = sizeRef.current
    const list = placementsRef.current
    for (let index = 0; index < list.length; index += 1) {
      const placement = list[index]
      const node = labelNodes.current[index]
      if (placement === undefined || node === null) continue
      const point = ring.projectLabel(placement.mid)
      node.style.left = `${point.x}px`
      node.style.top = `${point.y}px`
      const dx = point.x - current / 2
      node.style.transform =
        dx > current * 0.12
          ? 'translate(0, -50%)'
          : dx < -current * 0.12
            ? 'translate(-100%, -50%)'
            : 'translate(-50%, -50%)'
      node.style.opacity = '1'
    }
  }

  // 建场：只在画布挂上之后做一次，尺寸变了只 resize，不重播入场。
  useEffect(() => {
    if (canvas === null) return
    if (!webglSupported()) {
      setDegraded(true)
      return
    }

    let disposed = false
    let handle: ContourRing | null = null

    const onContextLost = (event: Event): void => {
      // preventDefault 让浏览器保留恢复的机会。
      event.preventDefault()
      setDegraded(true)
    }
    const onContextRestored = (): void => {
      setDegraded(false)
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    const boot = async (): Promise<void> => {
      try {
        const module = await loadRingModule()
        if (disposed) return
        handle = module.createContourRing({
          canvas,
          size: sizeRef.current,
          segments: segmentsRef.current,
          colors: BUCKET_COLORS,
          now: performance.now(),
        })
        ringRef.current = handle
        handle.onFrame(() => { positionLabels() })
        // 建场期间尺寸可能已经变了：按当前尺寸补一次。
        handle.resize(sizeRef.current)
      } catch (error) {
        // 分片拉不到 / 建场失败：退回 SVG 环，功能一条不少。
        // 但要留痕——静默降级会让「3D 怎么没出来」变成查不到的问题。
        console.warn('[dsh-usage-cmdkit] 3D 环不可用，已退回 SVG 环', error)
        if (!disposed) setDegraded(true)
      }
    }
    void boot()

    return () => {
      disposed = true
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      handle?.dispose()
      ringRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas])

  // 尺寸变化：只改画布大小，不重建场景。
  useEffect(() => {
    ringRef.current?.resize(size)
  }, [size])

  // 数据变化：弧长平滑插值过去。
  useEffect(() => {
    ringRef.current?.setSegments(segments)
  }, [segments])

  const counted = useCountUp(total, timing.number, 440)
  const v = RING_VARIANT[variant]

  if (degraded) {
    // 拿不到 3D 就用原来的 SVG 环：构图、读数、标签一条不少。
    return <UsageRing {...props} />
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, overflow: 'visible' }}>
      <canvas
        ref={setCanvas}
        width={size}
        height={size}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          visibility: degraded ? 'hidden' : 'visible',
        }}
      />

      {/* 环心总览：普通 DOM 文字，不随透视变形。 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: size * 0.022,
          pointerEvents: 'none',
          transform: 'translateY(-3%)',
        }}
      >
        <div
          style={{
            fontSize: Math.max(15, size * v.headline),
            fontWeight: 700,
            color: TEXT,
            letterSpacing: -size * 0.004,
            lineHeight: 1.05,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {format(counted)}
        </div>
        <div
          style={{
            fontSize: Math.max(8, size * v.caption),
            fontWeight: 500,
            color: MUTED,
            letterSpacing: size * v.caption * 0.115,
            lineHeight: 1.2,
          }}
        >
          {caption}
          {captionAccent !== undefined && (
            <>
              {' · '}
              <span style={{ color: ACCENT }}>{captionAccent}</span>
            </>
          )}
        </div>
        <div
          style={{
            fontSize: Math.max(8, size * v.sub),
            fontWeight: 400,
            color: MUTED,
            letterSpacing: size * v.sub * 0.09,
            lineHeight: 1.2,
          }}
        >
          {sub(counted)}
        </div>
      </div>

      {/* 环外标签：位置每帧由 3D 模块投影给出。 */}
      {placements.map((placement, index) => (
        <span
          key={placement.index}
          ref={(node) => { labelNodes.current[index] = node }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            opacity: 0,
            fontFamily: FONT_SANS,
            fontSize: Math.max(10, size * 0.03),
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: BUCKET_COLORS[placement.index] ?? ACCENT,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {placement.text}
        </span>
      ))}
    </div>
  )
}
