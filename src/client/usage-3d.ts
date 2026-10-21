/**
 * 3D 用量环：轨道矩阵（three.js）。
 *
 * 形态是一条完整的仪表带，从外到内：
 *   鳍片环 —— 84 根径向鳍片，高度按桶占比起伏，顶边按桶色发光（像频谱仪）
 *   底轨   —— 暗金属轨，勾住整圈轮廓
 *   刻度环 —— 72 格刻度，每 6 格一根长标记
 *   数据轨 —— 暗金属轨 + 四色数据弧 + 一个跑动的读取头
 *   环心   —— 空的，读数用普通 DOM 文字叠在上面
 *
 * 美术方向的出发点（这一版推翻过两次，记在这儿免得又走回头路）：
 * - **不用连续发光管承载数据**。那是霓虹灯管，不是科幻仪表。
 *   数据靠「暗金属件被点亮」——鳍片的顶边发光，数据弧是细的一条实体带。
 * - **大片暗、极少高能**。结构件比数据暗，金属只靠环境贴图拉出一道窄高光。
 * - **发光强度压在 1 附近**。超过 1.5 会被 ACES 推成白，辉光糊成一团。
 * - 辉光形状交给可控的加法壳，不用后期 bloom。
 *
 * 为什么没有后期合成器（这条踩过坑，别再走回头路）：
 *
 * 用 EffectComposer 时，场景是渲进 render target 的。three 在渲染到
 * render target 时**禁用材质级 tone mapping**（`WebGLPrograms` 里判
 * `currentRenderTarget === null`），ACES 改由 OutputPass 对**整帧**施加一次。
 * 于是材质上的 `toneMapped: false` 完全失效——弧的桶色照样被 ACES 推浅：
 * `#4c8dff` 过一遍 ACES 变成约 `#659ce2`，蓝弧看着发青、四个桶分不清。
 *
 * 直接 `renderer.render()` 之后，tone mapping 回到材质级，
 * `toneMapped: false` 才真的能让桶色原样输出。
 * 顺带把 UnrealBloomPass 那一整套（5 级 mip 模糊、十几次全屏绘制）也省了：
 * 分片更小，帧率更高，而辉光本来就该由加法壳可控地画出来。
 *
 * 角度约定（重要）：共享几何里的角度是「十二点方向起、顺时针铺开」（与 SVG 环一致），
 * 而 three 的 XY 平面是 y 朝上、角度逆时针为正。所以这里要做一次翻转：
 * `局部角 = -共享角`。**不翻的话 3D 环和 SVG 环的构图是镜像的**，
 * 拿不到 WebGL 退回 SVG 时画面会跳。
 *
 * 渲染预算：
 * - 入场与弧长插值期间满帧，播完立刻降档。
 * - 空闲自转走 **20fps 步进**：慢自转要看得见，但不值得烧 60fps。
 * - 画布不可见（面板收起、标签页切走）时整帧跳过。
 */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  EquirectangularReflectionMapping,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { RingSegment } from './usage-ring-geometry.js'

/**
 * 鳍片的最大数量。
 *
 * 实际画多少根随画布大小走：小环上 84 根鳍片挤成每根两三个像素，
 * 远看就是一片噪点。宁可少画几根、每根粗一点。
 */
const FIN_MAX = 84

/** 刻度的最大格数。 */
const TICK_MAX = 72

/** 鳍片根部半径（世界单位）：底轨外沿。 */
const FIN_BASE = 1.03

/** 鳍片高度 = 基数 + 占比 × 系数。占比大的桶，鳍片高。 */
const FIN_HEIGHT_BASE = 0.032
const FIN_HEIGHT_SCALE = 0.15

/**
 * 按画布大小定细节档位。
 *
 * 面板里环的直径在 190–300px 之间（见 UsageWide 的 ringSize），
 * 同一套细节在两端都不成立：小环上鳍片会挤成噪点，大环上又太素。
 */
interface Detail {
  /** 实际画多少根鳍片。 */
  fins: number
  /** 鳍片的切向宽度倍率。 */
  finWidth: number
  /** 实际画多少格刻度。 */
  ticks: number
}

/**
 * 按画布边长选细节档位。
 * @param size - 画布边长（px）。
 * @returns 细节档位。
 */
function detailFor(size: number): Detail {
  if (size >= 280) return { fins: FIN_MAX, finWidth: 1.15, ticks: TICK_MAX }
  if (size >= 230) return { fins: 64, finWidth: 1.5, ticks: 56 }
  if (size >= 190) return { fins: 48, finWidth: 2.2, ticks: 40 }
  return { fins: 32, finWidth: 2.8, ticks: 0 }
}

/** 底轨半径。 */
const RAIL_RADIUS = 1.0

/** 刻度环半径。 */
const TICK_RADIUS = 0.945

/** 刻度格数。 */
const TICK_COUNT = TICK_MAX

/** 数据轨半径：四色数据弧跑在这条轨上。 */
const TRACK_RADIUS = 0.86

/**
 * 环心暗盘半径：把洞压干净，DOM 读数才站得住。
 *
 * 必须小于数据轨（0.86）并留出余量：暗盘是方形平面，
 * 环倾斜之后它的投影会伸到轨道上，贴太近就会把弧盖掉。
 */
const CORE_RADIUS = 0.62

/** 环外标签的投影半径：落在最高的鳍片之外。 */
const LABEL_RADIUS = 1.3

/** 环平面的倾斜：绕 Y 轴 -0.5（≈29°）、绕 X 轴 0.26（≈15°）。 */
const TILT_Y = -0.5
const TILT_X = 0.26

/** 空闲自转速度（弧度/秒）。 */
const SPIN = 0.07

/** 空闲自转时的帧间隔（毫秒）：20fps，不是 60。 */
const IDLE_FRAME_MS = 50

/** 弧长插值的时长（毫秒）。 */
const INTERP_SPAN = 400

/** 入场时长（毫秒）。 */
const ENTRANCE_SPAN = 460

/** 相邻两个桶的入场错开量（毫秒）。 */
const ENTRANCE_STEP = 55

/** 段与段之间的缺口（弧度）：与 SVG 环的观感对齐。 */
const ARC_GAP = 0.045

/** 读取头的转速（弧度/秒）。 */
const HEAD_SPEED = 0.42

/**
 * 环上各条半径（世界单位）。
 *
 * 导出给设计稿渲染脚本用：`scripts/render-design-ring.mjs` 要按真实半径
 * 摆标签、量投影范围。抄一遍常量就会和实现漂移，导出才是一份事实。
 */
export const ORBIT_RADII = {
  /** 底轨半径。 */
  rail: RAIL_RADIUS,
  /** 刻度环半径。 */
  tick: TICK_RADIUS,
  /** 数据轨半径。 */
  track: TRACK_RADIUS,
  /** 环心暗盘半径。 */
  core: CORE_RADIUS,
  /** 环外标签的投影半径。 */
  label: LABEL_RADIUS,
  /** 鳍片根部半径。 */
  finBase: FIN_BASE,
  /** 鳍片最大高度。 */
  finHeight: FIN_HEIGHT_BASE + FIN_HEIGHT_SCALE,
} as const

/** 帧回调带出去的状态。 */
export interface FrameState {
  /** 当前自转角（弧度）：标签要跟着弧走，用它算位置。 */
  spin: number
}

/** 3D 环的操作句柄。 */
export interface OrbitMatrix {
  /** 更新分段：数据变了就调它，弧长平滑插值过去。 */
  setSegments(segments: readonly RingSegment[]): void
  /** 改画布尺寸（px）。 */
  resize(size: number): void
  /** 把环上的一个角度投影成标签锚点的画布像素坐标。 */
  projectLabel(angle: number): { x: number; y: number }
  /** 空闲自转开关：面板不可见时应关掉。 */
  setIdleSpin(enabled: boolean): void
  /**
   * 固定读取头的位置（局部角，弧度）；传 null 恢复自转。
   *
   * 设计稿要**可复现的构图**，所以读取头得能钉死——
   * 它默认按自身起点计时自转，渲染时机一变位置就变。
   */
  setHeadAngle(angle: number | null): void
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

/** 管状弧的材质选项。 */
interface ArcStyle {
  /** 压扁系数（z 方向），1 = 不压。 */
  flat?: number
  /** 径向偏移：把管子的中心线整体往外推。辉光壳用它躲开实体弧。 */
  offset?: number
  /** 不透明度：只对加法辉光壳有意义，实体弧始终不透明。 */
  opacity?: number
  /** 沿弧的分段数。 */
  tubular?: number
  /** 截面分段数。 */
  radial?: number
  /** 沿截面做亮度衰减：从内缘往外淡出，辉光才有「溢出来」的样子。 */
  fade?: boolean
}

/**
 * 造一段管状弧。
 *
 * 截面是椭圆管（z 方向被 `flat` 压扁），法线可以直接算出来
 * （径向 × cos + 轴向 × sin），不用每帧跑 computeVertexNormals。
 *
 * 两端有端盖：管子若是开口的，弧与弧之间的缺口会直接漏出背景，
 * 看着像数据被切了个口子。
 * @param radius - 弧所在的半径。
 * @param tube - 管半径。
 * @param color - 颜色。
 * @param style - 材质选项。
 * @returns 管状弧。
 */
function createArcTube(
  radius: number,
  tube: number,
  color: Color,
  style: ArcStyle = {},
): ArcTube {
  const radial = style.radial ?? 8
  const tubular = style.tubular ?? 64
  const rowSize = radial + 1
  const ringCount = (tubular + 1) * rowSize
  // 额外两个顶点：两端的端盖中心。
  const capStart = ringCount
  const capEnd = ringCount + 1
  const vertexCount = ringCount + 2
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  // 截面坐标：0 = 内缘，1 = 外缘。辉光壳靠它做径向衰减。
  const edges = new Float32Array(vertexCount)
  const indices: number[] = []
  for (let i = 0; i < tubular; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * rowSize + j
      const b = (i + 1) * rowSize + j
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  // 端盖：起止两个截面各补一个扇面。
  for (let j = 0; j < radial; j += 1) {
    indices.push(capStart, j + 1, j)
    const base = tubular * rowSize
    indices.push(capEnd, base + j, base + j + 1)
  }

  const geometry = new BufferGeometry()
  const position = new BufferAttribute(positions, 3)
  const normal = new BufferAttribute(normals, 3)
  geometry.setAttribute('position', position)
  geometry.setAttribute('normal', normal)
  geometry.setAttribute('aEdge', new BufferAttribute(edges, 1))
  geometry.setIndex(indices)

  const mesh = style.fade === true
    ? new Mesh(geometry, createFadeMaterial(color, style.opacity ?? 0.16))
    : new Mesh(
        geometry,
        // 弧用**不受光**的基础材质。
        //
        // 走 PBR 的话，细管朝径向、方向光基本照不到，
        // 弧只能靠自发光撑着——而自发光一高，ACES 就把桶色推成白
        //（蓝变青白、绿变荧光绿），四个桶分不清。
        //
        // 不受光就没有这个问题：桶色原样输出，一眼就对得上。
        // 「被点亮」的质感交给外面的辉光壳，两边各管一件事。
        new MeshBasicMaterial({
          color,
          toneMapped: false,
          // 管子是空心的圆管，正面背面都要画。
          side: DoubleSide,
        }),
      )
  if (style.flat !== undefined) mesh.scale.z = style.flat
  const offset = style.offset ?? 0

  const update = (start: number, sweep: number): void => {
    for (let i = 0; i <= tubular; i += 1) {
      const angle = start + (sweep * i) / tubular
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      for (let j = 0; j <= radial; j += 1) {
        const phi = (j / radial) * Math.PI * 2
        const cp = Math.cos(phi)
        const sp = Math.sin(phi)
        const offsetIndex = (i * rowSize + j) * 3
        positions[offsetIndex] = cos * (radius + offset + tube * cp)
        positions[offsetIndex + 1] = sin * (radius + offset + tube * cp)
        positions[offsetIndex + 2] = tube * sp
        normals[offsetIndex] = cos * cp
        normals[offsetIndex + 1] = sin * cp
        normals[offsetIndex + 2] = sp
        edges[i * rowSize + j] = (cp + 1) / 2
      }
    }
    // 端盖中心：落在中心线上，z 为 0。
    positions[capStart * 3] = Math.cos(start) * (radius + offset)
    positions[capStart * 3 + 1] = Math.sin(start) * (radius + offset)
    positions[capStart * 3 + 2] = 0
    positions[capEnd * 3] = Math.cos(start + sweep) * (radius + offset)
    positions[capEnd * 3 + 1] = Math.sin(start + sweep) * (radius + offset)
    positions[capEnd * 3 + 2] = 0
    position.needsUpdate = true
    normal.needsUpdate = true
    geometry.attributes.aEdge.needsUpdate = true
    geometry.computeBoundingSphere()
  }
  update(0, 0.01)

  return { mesh, update }
}

/**
 * 辉光壳的材质：沿截面从内缘往外淡出。
 *
 * 壳是一整圈加法混合的带子。如果亮度是均匀的，它就是一条**实心浅色带**，
 * 不是辉光——尤其在透明底的设计稿上，白底一衬更像一条塑料条。
 *
 * 所以按截面坐标做衰减：贴着实体弧那一侧最亮，往外淡到 0。
 * @param color - 桶色。
 * @param opacity - 峰值不透明度。
 * @returns 材质。
 */
function createFadeMaterial(color: Color, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      attribute float aEdge;
      varying float vEdge;
      void main() {
        vEdge = aEdge;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vEdge;
      void main() {
        float a = uOpacity * pow(max(0.0, 1.0 - vEdge), 1.8);
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
}

/**
 * 菲涅尔边缘光：正面沉、边缘亮。
 *
 * 科幻 UI 的招牌材质。three 的内置材质给不了这个——这里自己写一小段着色器，
 * 加法混合、不写深度，套在实体外面当轮廓光。
 * @param color - 颜色。
 * @param power - 菲涅尔指数，越大边缘越窄。
 * @param intensity - 强度。
 * @returns 边缘光材质。
 */
function createRimMaterial(color: number, power = 3.2, intensity = 0.55): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uPower: { value: power },
      uIntensity: { value: intensity },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), uPower);
        gl_FragColor = vec4(uColor * f * uIntensity, f * uIntensity);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
}

/** 暗色机械面：结构件的本色，靠细高光而不是亮度说话。 */
function createHousingMaterial(color = 0x0d141d, rough = 0.5): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    metalness: 0.9,
    roughness: rough,
    envMapIntensity: 0.8,
  })
}

/**
 * 鳍片材质：顶边亮、柱身暗。
 *
 * 顶点色负责「哪里亮」（顶面 1.0，柱身 0.28），instanceColor 负责「什么颜色」（桶色）。
 * 两者相乘 = vColor；再把 emissive 也乘 vColor（onBeforeCompile 打补丁），
 * 顶边才会真的按桶色发光，而柱身只是被染色的暗金属。
 * @returns 鳍片材质。
 */
function createFinMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.95,
    metalness: 0.72,
    roughness: 0.36,
    envMapIntensity: 1,
    vertexColors: true,
  })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;',
    )
  }
  return material
}

/**
 * 造一根鳍片的几何：柱身暗、顶边亮（顶点色）。
 *
 * BoxGeometry 的顶点按组排：px(0-3) nx(4-7) py(8-11) ny(12-15) pz(16-19) nz(20-23)。
 * 只有 8-11 是顶面——用高度判断会把侧面的上沿也算进去。
 * @param width - 切向宽度。
 * @param depth - 轴向厚度。
 * @returns 鳍片几何。
 */
function createFinGeometry(width = 0.021, depth = 0.05): BufferGeometry {
  const geometry = new BoxGeometry(width, 1, depth)
  // 从根部往上长：几何从 y=0 长到 y=1，缩放时就是从底轨往外长。
  geometry.translate(0, 0.5, 0)
  const count = geometry.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const isTop = i >= 8 && i < 12
    const v = isTop ? 1 : 0.28
    colors[i * 3] = v
    colors[i * 3 + 1] = v
    colors[i * 3 + 2] = v
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/**
 * 造径向刻度：一个 InstancedMesh 顶全部刻度，只占一次 draw call。
 *
 * 格子按最大数建好，实际画多少由 `setActive` 决定——小环上刻度太密，
 * 远看是一条实线。
 * @param options - 刻度参数。
 * @returns 刻度网格与生效格数的调节器。
 */
function createTicks(options: {
  /** 刻度所在的半径。 */
  radius: number
  /** 刻度格数（最大值）。 */
  count: number
  /** 副刻度长度。 */
  length: number
  /** 副刻度宽度。 */
  width: number
  /** 每隔几格来一根主刻度。 */
  every: number
  /** 主刻度长度。 */
  majorLength: number
  /** 主刻度宽度。 */
  majorWidth: number
  /** 材质。 */
  material: MeshStandardMaterial
}): { meshes: InstancedMesh[]; setActive: (active: number) => void } {
  const minor = new InstancedMesh(
    new BoxGeometry(options.length, options.width, 0.012),
    options.material,
    options.count,
  )
  const majorCount = Math.ceil(options.count / options.every)
  const major = new InstancedMesh(
    new BoxGeometry(options.majorLength, options.majorWidth, 0.012),
    options.material,
    majorCount,
  )
  const matrix = new Matrix4()
  const quaternion = new Quaternion()
  const axis = new Vector3(0, 0, 1)
  const position = new Vector3()
  const scale = new Vector3(1, 1, 1)
  const hidden = new Vector3(0, 0, 0)
  const minorAt: Matrix4[] = []
  const majorAt: Matrix4[] = []
  for (let i = 0; i < options.count; i += 1) {
    const angle = (i / options.count) * Math.PI * 2
    quaternion.setFromAxisAngle(axis, angle)
    position.set(Math.cos(angle) * options.radius, Math.sin(angle) * options.radius, 0)
    if (i % options.every === 0) {
      majorAt.push(matrix.clone().compose(position, quaternion, scale))
      minorAt.push(matrix.clone().compose(position, quaternion, hidden))
    } else {
      minorAt.push(matrix.clone().compose(position, quaternion, scale))
    }
  }
  const setActive = (active: number): void => {
    for (let i = 0; i < options.count; i += 1) {
      const at = minorAt[i]
      if (at !== undefined) minor.setMatrixAt(i, i < active ? at : matrix.compose(position, quaternion, hidden))
    }
    minor.instanceMatrix.needsUpdate = true
    for (let i = 0; i < majorCount; i += 1) {
      const at = majorAt[i]
      const keep = at !== undefined && i * options.every < active
      major.setMatrixAt(i, keep ? at : matrix.compose(position, quaternion, hidden))
    }
    major.instanceMatrix.needsUpdate = true
  }
  setActive(options.count)
  return { meshes: [minor, major], setActive }
}

/**
 * 造环心的暗盘：把洞压干净，DOM 读数才站得住。
 *
 * 这个暗盘**必须小**。它是一块方形平面，环倾斜之后它在屏幕上的投影
 * 是个被拉长的椭圆——近端边缘会伸到数据轨的投影位置上。
 * 半径给到 0.74（正好是轨道内侧）时，暗盘会把整圈数据弧盖住，
 * 画面上就只剩鳍片和刻度，数据等于消失了。
 *
 * 所以压到 0.62：给轨道留出足够的安全距离，暗盘只负责「洞是暗的」。
 * @param radius - 暗盘半径。
 * @returns 暗盘网格。
 */
function createCoreDisc(radius: number): Mesh {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    // 中间一大片**不透明**，只在最外圈淡出。
    //
    // 整张盘都做半透明渐变的话，截图时 Chrome 会给 alpha 通道加抖动，
    // 盘面上就出现一层可见的网点纹。改成「实心 + 边缘过渡」，
    // 抖动只落在最外面那一圈。
    gradient.addColorStop(0, 'rgba(5,7,11,1)')
    gradient.addColorStop(0.78, 'rgba(5,7,11,1)')
    gradient.addColorStop(0.9, 'rgba(5,7,11,0.72)')
    gradient.addColorStop(1, 'rgba(5,7,11,0)')
    ctx.fillStyle = gradient
    // 只填**圆**。
    //
    // 之前填的是整个正方形，而平面是 radius*2 的正方形：
    // 正方形的四个角伸到 radius*1.414 处，比数据轨（0.86）还远，
    // 于是暗盘的四角把远端的弧切掉了一截——小桶的弧整段消失。
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const disc = new Mesh(
    new PlaneGeometry(radius * 2, radius * 2),
    // 半透明 + 不写深度：暗盘只做「压暗」，不参与深度竞争，
    // 也不会挡住任何数据。
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  )
  // 透明队列内先画：暗盘是底，数据轨压在它上面。
  disc.renderOrder = -1
  return disc
}

/**
 * 造一片软边光晕：径向渐变的方片，加法混合。
 *
 * 读取头是环上唯一的亮点。用后期 bloom 去照亮它，等于为了一个点
 * 跑一整套全屏泛光；自己画一片软斑更省，也更好控。
 * @param size - 贴图边长（px）。
 * @param color - 光晕颜色（0xRRGGBB）。
 * @param opacity - 不透明度。
 * @returns 光晕网格。
 */
function createHaloSprite(size: number, color: number, opacity: number): Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, `rgba(${r},${g},${b},1)`)
    gradient.addColorStop(0.28, `rgba(${r},${g},${b},0.42)`)
    gradient.addColorStop(0.62, `rgba(${r},${g},${b},0.1)`)
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const sprite = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  return sprite
}

/**
 * 造环境贴图：暗底 + 几条细亮条。
 *
 * 金属没有环境贴图就是黑的。这里不用 RoomEnvironment：
 * 它太「室内白」，不像科幻。自己画一张黑底 + 细灯管，
 * 金属上只拉出一道窄高光，而不是整圈泛白。
 * @param renderer - 渲染器（用来做 PMREM 转换）。
 * @returns PMREM 纹理。
 */
function createEnvironment(renderer: WebGLRenderer): Texture {
  const width = 512
  const height = 256
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#05070b'
    ctx.fillRect(0, 0, width, height)

    const blue = ctx.createLinearGradient(0, 0, 0, height)
    blue.addColorStop(0, 'rgba(56,104,200,0.34)')
    blue.addColorStop(0.45, 'rgba(18,30,52,0.16)')
    blue.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = blue
    ctx.fillRect(0, 0, width, height)

    const strips = [
      { y: 40, h: 3, a: 0.62 },
      { y: 118, h: 2, a: 0.4 },
      { y: 202, h: 5, a: 0.26 },
    ]
    for (const strip of strips) {
      const gradient = ctx.createLinearGradient(0, strip.y - 5, 0, strip.y + strip.h + 5)
      gradient.addColorStop(0, 'rgba(255,255,255,0)')
      gradient.addColorStop(0.5, `rgba(214,232,255,${strip.a})`)
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, strip.y - 5, width, strip.h + 10)
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = SRGBColorSpace
  // 环境贴图要**自己**转成 PMREM：把等距柱状图直接丢给 scene.environment，
  // three 会在每次取用时重跑一遍转换，帧帧重算——实测能把空闲帧率从 20 顶到 36。
  const pmrem = new PMREMGenerator(renderer)
  const target = pmrem.fromEquirectangular(texture)
  texture.dispose()
  pmrem.dispose()
  return target.texture
}

/**
 * 造一个轨道矩阵。
 * @param options - 画布、初始分段、配色与起始时刻。
 * @returns 3D 环句柄。
 */
export function createOrbitMatrix(options: {
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
}): OrbitMatrix {
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
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = SRGBColorSpace

  const scene = new Scene()
  // 画布要透明地叠在面板的网格底纹上，所以场景不能有背景色。
  scene.environment = createEnvironment(renderer)

  const camera = new PerspectiveCamera(30, 1, 0.1, 100)
  camera.position.set(0, 0.34, 5.3)
  camera.lookAt(0, 0, 0)

  // 灯：主光偏冷白，轮廓光是电光蓝，底部一点紫。
  const key = new DirectionalLight(0xdce9ff, 1.9)
  key.position.set(3, 4, 3.2)
  scene.add(key)
  const rim = new DirectionalLight(0x4c8dff, 1.9)
  rim.position.set(-3.4, 0.6, -2.4)
  scene.add(rim)
  const under = new DirectionalLight(0xa855f7, 0.7)
  under.position.set(0.4, -3.2, 1.2)
  scene.add(under)

  // 辉光：不用后期 bloom，辉光由每一段弧外面那圈**加法壳**画出来。
  //
  // 形状因此是可控的：壳多大、亮多少，写死在几何里，不会像 bloom 那样
  // 把整条弧一起吸进去、桶色被推成白。
  // 读取头和鳍片顶边这类真高光，各自带一小片加法晕，不需要全屏泛光。

  // 环本体：整体倾斜，空闲时绕自身轴慢转。
  const root = new Group()
  root.rotation.y = TILT_Y
  root.rotation.x = TILT_X
  root.scale.setScalar(0.94)
  scene.add(root)

  /* ------------------------------------------------------------ 鳍片环 */

  const fins = new InstancedMesh(createFinGeometry(), createFinMaterial(), FIN_MAX)
  fins.instanceMatrix.setUsage(DynamicDrawUsage)
  root.add(fins)

  /** 当前细节档位：画布多大就画多少细节。 */
  let detail = detailFor(size)

  /* ------------------------------------------------------------ 底轨 */

  const railBand = new Mesh(
    new TorusGeometry(RAIL_RADIUS, 0.026, 10, 200),
    createHousingMaterial(0x0a1018, 0.45),
  )
  railBand.scale.z = 0.5
  root.add(railBand)
  root.add(new Mesh(
    new TorusGeometry(RAIL_RADIUS, 0.026, 10, 200),
    createRimMaterial(0x7fb2ff),
  ))

  /* ------------------------------------------------------------ 刻度环 */

  const tickMaterial = new MeshStandardMaterial({
    color: 0x495b76,
    metalness: 0.92,
    roughness: 0.36,
    emissive: 0x23456e,
    emissiveIntensity: 1.4,
  })
  const ticks = createTicks({
    radius: TICK_RADIUS,
    count: TICK_COUNT,
    length: 0.03,
    width: 0.004,
    every: 6,
    majorLength: 0.062,
    majorWidth: 0.009,
    material: tickMaterial,
  })
  for (const tick of ticks.meshes) root.add(tick)
  ticks.setActive(detail.ticks)

  /* ------------------------------------------------------------ 数据轨 */

  // 凹槽：暗金属的一圈轨，比数据弧宽，两侧留出暗边，
  // 读起来才像「数据嵌在槽里」，而不是一根浮着的彩色管子。
  const trackBand = new Mesh(
    new TorusGeometry(TRACK_RADIUS, 0.042, 12, 190),
    createHousingMaterial(0x0b1119, 0.42),
  )
  trackBand.scale.z = 0.42
  root.add(trackBand)

  const arcs: ArcTube[] = []
  const glows: ArcTube[] = []
  for (const hex of colors) {
    const color = new Color(hex)
    // 数据弧是**扁带**，不是圆管。
    //
    // 圆管的截面是圆的，z 方向也占了管半径那么宽。环一倾斜，
    // 这段 z 厚度会沿着投影的短轴方向糊到径向宽度上去：
    // 于是环的上下两端看着粗、左右两侧看着细 —— 同一根弧粗细差两成。
    // 把 z 压扁成 0.42，径向宽度就只由环平面决定，粗细一致。
    const arc = createArcTube(TRACK_RADIUS, 0.03, color, { flat: 0.42 })
    // 贴着凹槽顶面：下沿刚好落在槽上，上沿露出一点点。
    arc.mesh.position.z = 0.03
    root.add(arc.mesh)
    arcs.push(arc)
    // 加法辉光壳：辉光的形状由它可控，不用后期 bloom。
    //
    // 壳必须**完全落在弧的外侧，一像素都不许重叠**：
    // 弧占 0.83–0.89（中心 0.86，管半径 0.03），
    // 壳的 inner edge 必须在 0.89 之外，否则加法混合会把弧的颜色洗掉
    // （蓝弧被青色壳盖住 → 变成青白，四个桶分不清）。
    // 壳心 0.939、管半径 0.044 → 壳占 0.895–0.983，内缘刚好贴住弧的外缘。
    // 亮度沿截面往外淡出，所以它是辉光，不是一条实心浅色带。
    const glow = createArcTube(TRACK_RADIUS, 0.044, color, {
      fade: true,
      flat: 0.42,
      opacity: 0.5,
      offset: 0.079,
    })
    glow.mesh.position.z = 0.03
    // 辉光是加法混合，要压在实体弧**上面**才像「外溢的光」。
    glow.mesh.renderOrder = 2
    root.add(glow.mesh)
    glows.push(glow)
  }

  /* ------------------------------------------------------------ 读取头 */

  // 读取头是环上唯一的「白点」，但它**不能是纯白**。
  // 纯白（0xe8f2ff）的亮度接近 1.0，远超 bloom 的阈值 0.8，
  // 会被 bloom 当成高光源反复扩散 —— 画面上就是右下角炸出一大团白斑。
  // 改成偏蓝的冷白并压低亮度：它仍然是最亮的一点，但只在原地发亮。
  const head = new Group()
  head.add(new Mesh(
    new TorusGeometry(TRACK_RADIUS, 0.03, 8, 18, 0.16),
    new MeshBasicMaterial({ color: 0x6f9fd8, toneMapped: false }),
  ))
  // 读取头自带一片软斑：后期 bloom 拆掉之后，它仍是环上唯一的高能点。
  //
  // 斑不能大。它压在数据轨上，摊开就等于把一段数据糊掉——
  // 实测 0.26 世界单位（≈17°）的光斑能吞掉蓝弧尾部一大截。
  const headHalo = createHaloSprite(128, 0x6f9fd8, 0.9)
  headHalo.position.set(TRACK_RADIUS, 0, 0.012)
  headHalo.scale.setScalar(0.12)
  headHalo.renderOrder = 3
  head.add(headHalo)
  for (let i = 1; i <= 4; i += 1) {
    const trail = new Mesh(
      new TorusGeometry(TRACK_RADIUS, 0.024, 8, 16, 0.1),
      new MeshBasicMaterial({
        color: 0x3f6ea8,
        transparent: true,
        opacity: 0.3 / i,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    trail.rotation.z = -i * 0.1
    head.add(trail)
  }
  head.position.z = 0.03
  root.add(head)

  root.add(createCoreDisc(CORE_RADIUS))

  /* ------------------------------------------------------------ 分段状态 */

  /** 当前分段的起止角（每桶一对），用来做插值。 */
  let current: number[] = []
  /** 目标分段的起止角。 */
  let target: number[] = []
  /** 插值的起始时刻；0 表示不在插值。 */
  let interpStart = 0
  /** 入场是否已经落过终态。 */
  let settled = false
  /** 读取头的固定角度；null 表示让它自转。 */
  let headAngle: number | null = null

  const flatten = (segments: readonly RingSegment[]): number[] =>
    segments.flatMap((segment) => [segment.from, segment.to])

  /**
   * 把分段摊到数据轨上。
   *
   * 局部角 = -共享角：共享角是顺时针铺开的，three 的 y 朝上，所以要翻。
   * 翻完之后弧是从十二点方向**顺时针**铺出去的，与 SVG 环一致。
   */
  const applySegments = (values: readonly number[]): void => {
    for (let bucket = 0; bucket < arcs.length; bucket += 1) {
      const arc = arcs[bucket]
      const glow = glows[bucket]
      if (arc === undefined || glow === undefined) continue
      const from = values[bucket * 2] ?? 0
      const to = values[bucket * 2 + 1] ?? from
      const sweep = to - from
      // 缺口只留视觉上的一点点，别把很小的桶吃掉。
      const gap = Math.min(ARC_GAP, Math.max(0, sweep * 0.25))
      // 局部起点是 -from，终点是 -to；顺时针意味着 sweep 是负的。
      const localStart = -from + gap / 2
      const localSweep = -sweep - gap
      arc.update(localStart, localSweep)
      glow.update(localStart, localSweep)
      arc.mesh.visible = sweep > 0.002
      glow.mesh.visible = sweep > 0.002
    }
  }

  /**
   * 把鳍片摊开：按分段边界决定每根鳍片属于哪个桶、高多少。
   *
   * `growth` 是每个桶的生长系数（0–1）：入场时按桶错开长出来，
   * 插值期间恒为 1。
   */
  const applyFins = (values: readonly number[], growth: readonly number[]): void => {
    const matrix = new Matrix4()
    const quaternion = new Quaternion()
    const axis = new Vector3(0, 0, 1)
    const position = new Vector3()
    const scale = new Vector3()
    const full = Math.PI * 2
    for (let i = 0; i < FIN_MAX; i += 1) {
      const localAngle = (i / FIN_MAX) * full
      // 局部角反推共享角：共享角 = -局部角。
      const shared = ((-localAngle % full) + full) % full
      let bucket = -1
      let share = 0
      for (let b = 0; b < values.length / 2; b += 1) {
        const from = values[b * 2] ?? 0
        const to = values[b * 2 + 1] ?? from
        const start = ((from % full) + full) % full
        const end = ((to % full) + full) % full
        const inside = start <= end
          ? shared >= start && shared < end
          : shared >= start || shared < end
        if (!inside) continue
        bucket = b
        share = (to - from) / full
        break
      }
      // 鳍片径向朝外：绕 Z 转 (a - π/2)，局部 +Y 才对上径向。
      quaternion.setFromAxisAngle(axis, localAngle - Math.PI / 2)
      position.set(Math.cos(localAngle) * FIN_BASE, Math.sin(localAngle) * FIN_BASE, 0)
      const grow = bucket < 0 ? 0 : (growth[bucket] ?? 1)
      const height = (FIN_HEIGHT_BASE + share * FIN_HEIGHT_SCALE) * grow
      // 细节档位之外的鳍片直接压扁成零——小环上 84 根鳍片会挤成噪点。
      const width = i < detail.fins ? detail.finWidth : 0.001
      scale.set(width, Math.max(0.004, height), 1)
      matrix.compose(position, quaternion, scale)
      fins.setMatrixAt(i, matrix)
      const hex = bucket < 0 ? 0x0a0f16 : (colors[bucket] ?? '#4c8dff')
      fins.setColorAt(i, new Color(hex))
    }
    fins.instanceMatrix.needsUpdate = true
    if (fins.instanceColor) fins.instanceColor.needsUpdate = true
  }

  current = flatten(options.segments)
  target = current.slice()

  /* ------------------------------------------------------------ 渲染循环 */

  let idleSpin = true
  let frame = 0
  let lastRender = 0
  let listener: ((state: FrameState) => void) | null = null
  let disposed = false

  /** 入场与插值共用的「每桶生长系数」。 */
  const growth = new Array<number>(4).fill(0)

  const tick = (stamp: number): void => {
    if (disposed) return
    frame = requestAnimationFrame(tick)

    const elapsed = stamp - startedAt
    const spin = idleSpin ? (elapsed / 1000) * SPIN : root.rotation.z

    // 这一帧要不要画：入场与弧长插值期间满帧，其余时间按 20fps 步进。
    // 门槛放在更新之前——跳过的帧连场景都不用改，省的不只是 GPU。
    const interpolating = interpStart > 0
    const entering = elapsed < ENTRANCE_SPAN + ENTRANCE_STEP * 4
    const busy = entering || interpolating

    // 画布不可见就不画：面板收起、标签页切走都走这条路。
    const visible = canvas.clientWidth > 0 && canvas.clientHeight > 0 && !document.hidden
    if (!visible) return
    if (!busy && stamp - lastRender < IDLE_FRAME_MS) return
    lastRender = stamp

    root.rotation.z = spin

    // 入场：整环从内侧撑开。
    const entrance = 1 - (1 - Math.max(0, Math.min(1, elapsed / ENTRANCE_SPAN))) ** 3
    root.scale.setScalar(0.94 * (0.92 + 0.08 * entrance))

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
      growth.fill(1)
      applyFins(mixed, growth)
      if (p >= 1) {
        current = target.slice()
        interpStart = 0
      }
    } else if (entering) {
      // 入场：弧长从 0 生长到目标，鳍片按桶错开长出来。
      const grown: number[] = []
      for (let bucket = 0; bucket < target.length / 2; bucket += 1) {
        const from = target[bucket * 2] ?? 0
        const to = target[bucket * 2 + 1] ?? from
        const delay = bucket * ENTRANCE_STEP
        const p = Math.max(0, Math.min(1, (elapsed - delay) / ENTRANCE_SPAN))
        const eased = 1 - (1 - p) ** 3
        growth[bucket] = eased
        grown.push(from)
        grown.push(from + (to - from) * eased)
      }
      applySegments(grown)
      applyFins(grown, growth)
    } else if (!settled) {
      // 入场收尾：把弧长与鳍片**定死**到目标值。
      //
      // 这一步不能省，也不能指望「入场最后一帧刚好落在 680ms 之前」。
      // applySegments 只在入场期间被调用；帧率一掉（软件渲染、后台标签页、
      // 机器卡顿、大图慢一点），入场的最后一帧可能停在 200ms，
      // 于是每段弧都只长到一半——数据看着像被截短了。
      //
      // 所以入场结束后必须显式落一次终态，且只落一次。
      growth.fill(1)
      applySegments(target)
      applyFins(target, growth)
      settled = true
    }

    // 读取头从环自己的起点开始走。
    //
    // 早先这里用的是 rAF 的页面时间戳，那意味着「环刚创建时读取头在哪儿」
    // 取决于页面已经开了多久——面板重开一次，它就换了个位置。
    head.rotation.z = headAngle ?? -(((stamp - startedAt) / 1000) * HEAD_SPEED)

    renderer.render(scene, camera)
    listener?.({ spin })
  }

  // 初始状态：空的，等入场把它带出来。
  const empty: number[] = []
  for (let bucket = 0; bucket < target.length / 2; bucket += 1) {
    const from = target[bucket * 2] ?? 0
    empty.push(from, from)
  }
  applySegments(empty)
  applyFins(target, growth)
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
      // 新目标要重新落一次终态。
      settled = false
    },
    resize(next: number): void {
      if (next === size) return
      size = next
      renderer.setSize(size, size, false)
      camera.aspect = 1
      camera.updateProjectionMatrix()
      // 画布变大变小，细节档位跟着换：小环上鳍片不能那么密。
      const nextDetail = detailFor(size)
      if (nextDetail.fins !== detail.fins || nextDetail.finWidth !== detail.finWidth) {
        detail = nextDetail
        ticks.setActive(detail.ticks)
        applyFins(current, growth)
      }
    },
    projectLabel(angle: number): { x: number; y: number } {
      root.updateMatrixWorld(true)
      // 局部角 = -共享角，与数据弧同一套坐标，标签才会落在自己的弧上。
      const local = -angle
      const point = new Vector3(
        Math.cos(local) * LABEL_RADIUS,
        Math.sin(local) * LABEL_RADIUS,
        0,
      )
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
    setHeadAngle(angle: number | null): void {
      headAngle = angle
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
          if (Array.isArray(material)) material.forEach((item) => item.dispose())
          else material.dispose()
        }
      })
      renderer.dispose()
    },
  }
}
