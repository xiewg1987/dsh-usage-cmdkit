/**
 * 3D 用量环：等高线层环（three.js）。
 *
 * 形态是六层细环片叠成的浮雕环：每层按四桶分成四段色弧，
 * 层与层半径不同、Z 不同、每层反向微旋，叠出等高线一样的螺旋错位，
 * 外层再跑一道扫描光弧。**它不是甜甜圈**——环心是空的，读数用普通 DOM 文字叠在上面。
 *
 * 为什么不用 TorusGeometry：
 * 刷新时四段弧长要平滑插值（SVG 环是 stroke-dasharray 过渡），
 * 而 TorusGeometry 每次改弧长都要重建几何。这里自己拼管状几何，
 * 顶点位置与法线**原地改**，插值时只更新缓冲区，不产生垃圾。
 *
 * 渲染预算（重要）：
 * - 入场与弧长插值期间按满帧渲染，播完立刻降档。
 * - 空闲自转走 **20fps 低帧率步进**：慢自转要看得见，但不值得烧 60fps。
 * - 画布不可见（面板收起、标签页切走、宽高为 0）时整帧跳过。
 *
 * 依赖：three 整包内联进产物（宿主模块表里没有任何 3D 库，
 * client bundle 的 require 也只认种子词，第三方库只能自己带）。
 */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  EquirectangularReflectionMapping,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { RingSegment } from './usage-ring-geometry.js'

/** 层数：六层叠出浮雕。 */
const LAYERS = 6

/**
 * 内层半径（世界单位）：环心的洞要装得下读数。
 *
 * 洞的横向净空 = 半径 × 2 × cos(35°)（倾斜会横向压扁），
 * 窄栏最小环（170px）时读数约 78px 宽——内层半径给到 0.92 才装得下。
 */
const RADIUS_MIN = 0.92

/** 外层半径（世界单位）。 */
const RADIUS_MAX = 1.34

/** 层与层之间的 Z 间距（世界单位）。 */
const SPREAD_Z = 0.34

/** 环平面的倾斜：绕 Y 轴 35°、绕 X 轴 16°。 */
const TILT_Y = -0.61
const TILT_X = 0.28

/**
 * 相邻层之间的固定错位（弧度）。
 *
 * 层与层要错开一点才有等高线的味道，但错位**不能随时间累积**——
 * 之前写成转速的倍数，跑上几分钟层与层就彻底散架，四色的边界再也对不上。
 * 现在是固定错位 + 一点点来回摆。
 */
const LAYER_SKEW = 0.16

/** 层间摆动的幅度（弧度）。 */
const LAYER_WOBBLE = 0.018

/** 空闲自转速度（弧度/秒）：慢到不抢眼，快到能看出是活的。 */
const SPIN = 0.1

/** 空闲自转时的帧间隔（毫秒）：20fps，不是 60。 */
const IDLE_FRAME_MS = 50

/** 弧长插值的时长（毫秒）。 */
const INTERP_SPAN = 400

/** 入场时长（毫秒）。 */
const ENTRANCE_SPAN = 460

/** 相邻两层的入场错开量（毫秒）。 */
const ENTRANCE_STEP = 55

/** 段与段之间的缺口（弧度）：与 SVG 环的观感对齐。 */
const ARC_GAP = 0.045

/** 扫描光弧的角度长度（弧度）。 */
const SCAN_SPAN = 0.5

/** 扫描光弧的转速（弧度/秒）。 */
const SCAN_SPEED = 0.55

/** 帧回调带出去的状态。 */
export interface FrameState {
  /** 当前自转角（弧度）：标签要跟着弧走，用它算位置。 */
  spin: number
}

/** 3D 环的操作句柄。 */
export interface ContourRing {
  /** 更新分段：数据变了就调它，弧长平滑插值过去。 */
  setSegments(segments: readonly RingSegment[]): void
  /** 改画布尺寸（px）。 */
  resize(size: number): void
  /** 把环上的一个角度投影成标签锚点的画布像素坐标。 */
  projectLabel(angle: number): { x: number; y: number }
  /** 空闲自转开关：面板不可见时应关掉。 */
  setIdleSpin(enabled: boolean): void
  /** 订阅每帧回调。 */
  onFrame(listener: ((state: FrameState) => void) | null): void
  /** 销毁：停帧、释放几何与渲染器。 */
  dispose(): void
}

/** 一段可原地更新的管状弧。 */
interface ArcTube {
  /** 挂在场景里的网格。 */
  mesh: Mesh
  /** 改弧的起止角。 */
  update(start: number, sweep: number): void
}

/**
 * 造一段管状弧。
 *
 * 截面是圆管，法线可以直接算出来（径向 × cos + 轴向 × sin），
 * 不用每帧跑 computeVertexNormals。
 * @param radius - 弧所在的半径。
 * @param tube - 管半径。
 * @param color - 颜色。
 * @param tubular - 沿弧的分段数。
 * @param radial - 截面分段数。
 * @returns 管状弧。
 */
function createArcTube(
  radius: number,
  tube: number,
  color: Color,
  tubular = 64,
  radial = 8,
): ArcTube {
  const rowSize = radial + 1
  const vertexCount = (tubular + 1) * rowSize
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const indices: number[] = []
  for (let i = 0; i < tubular; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * rowSize + j
      const b = (i + 1) * rowSize + j
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const geometry = new BufferGeometry()
  const position = new BufferAttribute(positions, 3)
  const normal = new BufferAttribute(normals, 3)
  geometry.setAttribute('position', position)
  geometry.setAttribute('normal', normal)
  geometry.setIndex(indices)

  const material = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.26,
    metalness: 0.85,
    roughness: 0.28,
    envMapIntensity: 1.6,
    transparent: true,
    opacity: 1,
    side: DoubleSide,
    // 关键：three 对「透明 + 双面」的物体会先画背面再画正面，
    // 每遍还置一次 needsUpdate —— 也就是每帧重编译一次着色器。
    // 24 段弧一轮下来就是 24 次重编译 + 48 次 draw call。
    // 管子很细，单遍就够了。
    forceSinglePass: true,
  })
  const mesh = new Mesh(geometry, material)

  const update = (start: number, sweep: number): void => {
    for (let i = 0; i <= tubular; i += 1) {
      const angle = start + (sweep * i) / tubular
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      for (let j = 0; j <= radial; j += 1) {
        const phi = (j / radial) * Math.PI * 2
        const cp = Math.cos(phi)
        const sp = Math.sin(phi)
        const offset = (i * rowSize + j) * 3
        positions[offset] = cos * (radius + tube * cp)
        positions[offset + 1] = sin * (radius + tube * cp)
        positions[offset + 2] = tube * sp
        normals[offset] = cos * cp
        normals[offset + 1] = sin * cp
        normals[offset + 2] = sp
      }
    }
    position.needsUpdate = true
    normal.needsUpdate = true
    geometry.computeBoundingSphere()
  }
  update(0, 0.01)

  return { mesh, update }
}

/**
 * 造环境贴图：一张竖直渐变的等距柱状图。
 *
 * 金属材质没有环境贴图就是黑的。这里不用 RoomEnvironment：
 * 自己画一张渐变，既省一份依赖，又能直接对上面板的近黑底 + 电光蓝。
 * @returns 等距柱状环境贴图。
 */
function createEnvironment(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 128)
    gradient.addColorStop(0, '#9dc2ff')
    gradient.addColorStop(0.42, '#2b3543')
    gradient.addColorStop(1, '#05070b')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 128)
    // 主光斑：金属高光的来源。
    const spot = ctx.createRadialGradient(62, 26, 0, 62, 26, 74)
    spot.addColorStop(0, 'rgba(255,255,255,0.95)')
    spot.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = spot
    ctx.fillRect(0, 0, 256, 128)
  }
  const texture = new CanvasTexture(canvas)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * 造环背后的柔光晕。
 * @param radius - 光晕的世界半径。
 * @returns 光晕网格。
 */
function createHalo(radius: number): Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, 'rgba(76,141,255,0.26)')
    gradient.addColorStop(0.45, 'rgba(76,141,255,0.07)')
    gradient.addColorStop(1, 'rgba(76,141,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)
  }
  const texture = new CanvasTexture(canvas)
  const mesh = new Mesh(
    new PlaneGeometry(radius * 2, radius * 2),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  )
  mesh.position.z = -0.78
  return mesh
}

/**
 * 造环心的暗盘。
 *
 * 环心的读数是普通 DOM 文字，它要落在环心的洞里；
 * 洞里若透出背景网格，文字就不好读。这块暗盘把洞压干净，
 * 边缘渐隐，和 v4 的能量核是一个意思。
 * @param radius - 暗盘半径。
 * @returns 暗盘网格。
 */
function createCore(radius: number): Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, 'rgba(6,8,13,0.97)')
    gradient.addColorStop(0.68, 'rgba(6,8,13,0.88)')
    gradient.addColorStop(1, 'rgba(6,8,13,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)
  }
  const texture = new CanvasTexture(canvas)
  const mesh = new Mesh(
    new PlaneGeometry(radius * 2, radius * 2),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  )
  return mesh
}

/**
 * 造一个等高线层环。
 * @param options - 画布、初始分段、配色与起始时刻。
 * @returns 3D 环句柄。
 */
export function createContourRing(options: {
  /** 画布元素。 */
  canvas: HTMLCanvasElement
  /** 画布边长（px）。 */
  size: number
  /** 初始分段。 */
  segments: readonly RingSegment[]
  /** 四个桶的配色。 */
  colors: readonly string[]
  /** 起始时刻（毫秒时间戳）。 */
  now: number
}): ContourRing {
  const { canvas, colors } = options
  let size = options.size
  const startedAt = options.now

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))
  renderer.setSize(size, size, false)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.outputColorSpace = SRGBColorSpace

  const scene = new Scene()
  // 环境贴图要**自己**转成 PMREM：把等距柱状图直接丢给 scene.environment，
  // three 会在每次取用时重跑一遍转换，帧帧重算——实测能把空闲帧率从 20 顶到 36。
  const pmrem = new PMREMGenerator(renderer)
  const equirect = createEnvironment()
  const envTarget = pmrem.fromEquirectangular(equirect)
  scene.environment = envTarget.texture
  equirect.dispose()
  pmrem.dispose()

  const camera = new PerspectiveCamera(30, 1, 0.1, 100)
  // 相机拉远一点：环占画布约八成，剩下的留给环外标签和透视呼吸。
  camera.position.set(0, 0.5, 5.7)
  camera.lookAt(0, 0, 0)

  const key = new DirectionalLight(0xffffff, 2.7)
  key.position.set(3.2, 4.2, 3.6)
  scene.add(key)
  const rim = new DirectionalLight(0x4c8dff, 3.2)
  rim.position.set(-3.6, 0.8, -2.2)
  scene.add(rim)
  const fill = new DirectionalLight(0xa855f7, 1.5)
  fill.position.set(0.6, -3.4, 1.4)
  scene.add(fill)

  // 环本体：整体倾斜，层与层再各自微旋。
  const root = new Group()
  root.rotation.y = TILT_Y
  root.rotation.x = TILT_X
  scene.add(root)
  root.add(createHalo(1.62))
  // 环心的暗盘：把洞压干净，读数才站得住。
  root.add(createCore(RADIUS_MIN - 0.04))

  interface Layer {
    /** 这一层的容器。 */
    group: Group
    /** 四段色弧。 */
    tubes: ArcTube[]
    /** 这一层的材质（入场要单独淡入）。 */
    materials: MeshStandardMaterial[]
    /** 层序（0 最内）。 */
    k: number
  }

  const layers: Layer[] = []
  for (let k = 0; k < LAYERS; k += 1) {
    const ratio = k / (LAYERS - 1)
    const radius = RADIUS_MIN + ratio * (RADIUS_MAX - RADIUS_MIN)
    const z = (ratio - 0.5) * SPREAD_Z
    const tube = 0.018 + 0.012 * Math.sin(ratio * Math.PI)
    const group = new Group()
    group.position.z = z
    const tubes: ArcTube[] = []
    const materials: MeshStandardMaterial[] = []
    for (let index = 0; index < colors.length; index += 1) {
      const arc = createArcTube(radius, tube, new Color(colors[index] ?? '#4c8dff'))
      group.add(arc.mesh)
      tubes.push(arc)
      materials.push(arc.mesh.material as MeshStandardMaterial)
    }
    root.add(group)
    layers.push({ group, tubes, materials, k: ratio })
  }

  // 扫描光弧：贴在外层外沿跑，像读数头扫过数据。
  const scan = createArcTube(RADIUS_MAX + 0.035, 0.026, new Color('#ffffff'), 24, 8)
  scan.mesh.material = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
  root.add(scan.mesh)

  /* ------------------------------------------------------------ 分段状态 */

  /** 当前分段的起止角（每桶一对），用来做插值。 */
  let current: number[] = []
  /** 目标分段的起止角。 */
  let target: number[] = []
  /** 插值的起始时刻；0 表示不在插值。 */
  let interpStart = 0

  const flatten = (segments: readonly RingSegment[]): number[] =>
    segments.flatMap((segment) => [segment.from, segment.to])

  current = flatten(options.segments)
  target = current.slice()

  const applySegments = (values: readonly number[]): void => {
    for (let index = 0; index < layers.length; index += 1) {
      const layer = layers[index]
      if (layer === undefined) continue
      for (let bucket = 0; bucket < layer.tubes.length; bucket += 1) {
        const tube = layer.tubes[bucket]
        if (tube === undefined) continue
        const from = values[bucket * 2] ?? 0
        const to = values[bucket * 2 + 1] ?? from
        const sweep = to - from
        // 缺口只留视觉上的一点点，别把很小的桶吃掉。
        const gap = Math.min(ARC_GAP, Math.max(0, sweep * 0.25))
        tube.update(from + gap / 2, Math.max(0, sweep - gap))
        tube.mesh.visible = sweep > 0.002
      }
    }
  }
  applySegments(current)

  /* ------------------------------------------------------------ 渲染循环 */

  let idleSpin = true
  let frame = 0
  let lastRender = 0
  let listener: ((state: FrameState) => void) | null = null
  let disposed = false

  const tick = (stamp: number): void => {
    if (disposed) return
    frame = requestAnimationFrame(tick)

    const elapsed = stamp - startedAt
    const spin = idleSpin ? (elapsed / 1000) * SPIN : root.rotation.z

    // 这一帧要不要画：入场与弧长插值期间满帧，其余时间按 20fps 步进。
    // 门槛放在更新之前——跳过的帧连场景都不用改，省的不只是 GPU。
    const interpolating = interpStart > 0
    const busy = elapsed < ENTRANCE_SPAN + ENTRANCE_STEP * LAYERS || interpolating

    // 画布不可见就不画：面板收起、标签页切走都走这条路。
    const visible = canvas.clientWidth > 0 && canvas.clientHeight > 0 && !document.hidden
    if (!visible) return
    if (!busy && stamp - lastRender < IDLE_FRAME_MS) return
    lastRender = stamp

    root.rotation.z = spin

    // 入场：层与层错开淡入并从内侧撑开。
    for (const layer of layers) {
      const delay = layer.k * ENTRANCE_STEP
      const p = Math.max(0, Math.min(1, (elapsed - delay) / ENTRANCE_SPAN))
      const eased = 1 - (1 - p) ** 3
      const scale = 0.9 + 0.1 * eased
      layer.group.scale.set(scale, scale, scale)
      for (const material of layer.materials) {
        material.opacity = eased
      }
      // 层与层的固定错位 + 一点点摆动：错位不随时间累积。
      layer.group.rotation.z =
        (layer.k - 0.5) * LAYER_SKEW + Math.sin(elapsed * 0.0006 + layer.k * 1.4) * LAYER_WOBBLE
    }

    // 弧长插值。
    if (interpolating) {
      const p = Math.max(0, Math.min(1, (stamp - interpStart) / INTERP_SPAN))
      const eased = 1 - (1 - p) ** 3
      const mixed: number[] = []
      for (let i = 0; i < current.length; i += 1) {
        const from = current[i] ?? 0
        const to = target[i] ?? from
        mixed.push(from + (to - from) * eased)
      }
      applySegments(mixed)
      if (p >= 1) {
        current = target.slice()
        interpStart = 0
      }
    }

    scan.update((stamp / 1000) * SCAN_SPEED, SCAN_SPAN)

    renderer.render(scene, camera)
    listener?.({ spin })
  }

  frame = requestAnimationFrame(tick)

  /* ------------------------------------------------------------ 对外接口 */

  return {
    setSegments(segments: readonly RingSegment[]): void {
      const next = flatten(segments)
      // 起点取当前插值位置：连着按两次刷新不会跳。
      if (interpStart > 0) {
        const p = Math.max(0, Math.min(1, (performance.now() - interpStart) / INTERP_SPAN))
        const eased = 1 - (1 - p) ** 3
        const mixed: number[] = []
        for (let i = 0; i < current.length; i += 1) {
          const from = current[i] ?? 0
          const to = target[i] ?? from
          mixed.push(from + (to - from) * eased)
        }
        current = mixed
      }
      target = next
      interpStart = performance.now()
    },
    resize(next: number): void {
      if (next === size) return
      size = next
      renderer.setSize(size, size, false)
      camera.aspect = 1
      camera.updateProjectionMatrix()
    },
    projectLabel(angle: number): { x: number; y: number } {
      root.updateMatrixWorld(true)
      const point = new Vector3(Math.cos(angle) * (RADIUS_MAX + 0.04), Math.sin(angle) * (RADIUS_MAX + 0.04), 0)
      root.localToWorld(point)
      point.project(camera)
      const x = (point.x * 0.5 + 0.5) * size
      const y = (-point.y * 0.5 + 0.5) * size
      // 再往外推一点：标签贴着环的外缘，不压住环本身。
      const dx = x - size / 2
      const dy = y - size / 2
      const length = Math.hypot(dx, dy) || 1
      const push = size * 0.05
      return { x: x + (dx / length) * push, y: y + (dy / length) * push }
    },
    setIdleSpin(enabled: boolean): void {
      idleSpin = enabled
    },
    onFrame(next: ((state: FrameState) => void) | null): void {
      listener = next
    },
    dispose(): void {
      disposed = true
      cancelAnimationFrame(frame)
      listener = null
      scene.traverse((object) => {
        const mesh = object as Mesh
        if (mesh.geometry !== undefined) mesh.geometry.dispose()
        const material = mesh.material
        if (material !== undefined) {
          const list = Array.isArray(material) ? material : [material]
          for (const item of list) item.dispose()
        }
      })
      renderer.dispose()
      envTarget.dispose()
    },
  }
}
