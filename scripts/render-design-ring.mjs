/**
 * 渲染设计稿用的 3D 用量环。
 *
 * ## 为什么必须走仓库的真实模块
 *
 * 设计稿里的环和面板里的环必须**是同一个东西**。
 * 早先拿一份手抄的原型脚本渲染，结果设计稿的构图和实现对不上：
 * 弧段发光强度、鳍片朝向、标签角度全都漂了，改实现的时候设计稿不会跟着动。
 *
 * 所以这里直接 import `src/client/usage-3d.ts`：
 * 场景、材质、几何、共用角度约定全部来自实现本身。
 * 设计稿要改构图，先改实现。
 *
 * ## 输出
 *
 * - `design/dsh-cmdkit-ring-3d.png` —— 透明底的高分辨率渲染
 * - `design/dsh-cmdkit-ring-3d.json` —— 屏幕坐标几何（标签锚点、各半径的投影范围）
 *
 * ## 用法
 *
 * ```bash
 * node scripts/render-design-ring.mjs          # 1024
 * node scripts/render-design-ring.mjs 2048     # 2 倍图
 * ```
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { build } from 'esbuild'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Chrome 的可能位置：环境变量优先，其次是常见安装路径。 */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter((path) => typeof path === 'string' && path.length > 0)

/**
 * 设计稿那一套数据。
 *
 * 与 Figma 里 v4 稿的四行遥测完全一致（284,310 / 209,560 / 163,720 / 85,018），
 * 百分比也对得上：38% / 28% / 22% / 12%。
 */
const BUCKETS = {
  uncachedInputTokens: 284310,
  outputTokens: 209560,
  cacheReadTokens: 163720,
  cacheWriteTokens: 85018,
}

/** 四个桶的品类色：与 `usage-theme.ts` 的 BUCKET_COLORS 同序。 */
const COLORS = ['#4c8dff', '#22c55e', '#a855f7', '#f59e0b']

/** 默认渲染边长。 */
const DEFAULT_SIZE = 1024

/**
 * 页面脚本。
 *
 * 用 `+` 拼字符串而不是模板字符串：这段代码会被原样写进 HTML，
 * 里面的 `${}` 不能被 Node 提前插值。
 */
function pageScript(size) {
  return `
(() => {
  const SIZE = ${size}
  const canvas = document.getElementById('c')
  canvas.width = SIZE
  canvas.height = SIZE
  canvas.style.width = SIZE + 'px'
  canvas.style.height = SIZE + 'px'

  const buckets = ${JSON.stringify(BUCKETS)}
  const colors = ${JSON.stringify(COLORS)}

  const segments = __dshRing.ringSegments(buckets)
  const labels = ['38%', '28%', '22%', '12%']
  const now = performance.now()
  const handle = __dshRing.createOrbitMatrix({ canvas, size: SIZE, segments, colors, now })
  // 自转关掉：环停在零位，构图才可复现（共享角从十二点顺时针铺开）。
  handle.setIdleSpin(false)
  // 读取头也钉死：它默认按自身起点自转，渲染时机一变位置就变，
  // 设计稿必须是可复现的构图。位置取共享角 -90°（蓝弧的起点，投影在画面顶部）。
  handle.setHeadAngle(Math.PI / 2)

  const CENTER = { x: SIZE / 2, y: SIZE / 2 }
  const PUSH = SIZE * 0.05

  /** projectLabel 会把锚点往外推一点；这里把那次推动反解掉，拿回真实投影点。 */
  function rawAt(sharedAngle) {
    const p = handle.projectLabel(sharedAngle)
    const dx = p.x - CENTER.x
    const dy = p.y - CENTER.y
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x - (dx / len) * PUSH, y: p.y - (dy / len) * PUSH }
  }

  /** 共享角 -> 环平面上的世界坐标（局部角 = -共享角，和数据弧同一套坐标）。 */
  function planePoint(sharedAngle, radius) {
    const local = -sharedAngle
    return { x: Math.cos(local) * radius, y: Math.sin(local) * radius }
  }

  /**
   * 拟合「环平面坐标 -> 屏幕像素」的单应矩阵。
   *
   * 相机固定、环面固定，所以这是一个严格的射影变换：
   * 知道 4 组对应点就能把整个平面的映射算出来。
   * 这样环平面上的任意半径、任意角度的屏幕位置都能精确求出来，
   * 不需要知道倾角、缩放这些内部常量——它们已经被拟合吸收了。
   */
  function fitHomography(pairs) {
    // 矩阵一律用行主序的 9 元数组表示。
    const mul3 = (a, b) => {
      const out = new Array(9).fill(0)
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          let sum = 0
          for (let k = 0; k < 3; k += 1) sum += a[i * 3 + k] * b[k * 3 + j]
          out[i * 3 + j] = sum
        }
      }
      return out
    }
    const inv3 = (m) => {
      const [a, b, c, d, e, f, g, h, i] = m
      const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
      if (Math.abs(det) < 1e-12) throw new Error('单应矩阵奇异：拟合点退化')
      const k = 1 / det
      return [
        (e * i - f * h) * k, (c * h - b * i) * k, (b * f - c * e) * k,
        (f * g - d * i) * k, (a * i - c * g) * k, (c * d - a * f) * k,
        (d * h - e * g) * k, (b * g - a * h) * k, (a * e - b * d) * k,
      ]
    }
    // 归一化矩阵：把点云搬到中心在原点、平均距离约 sqrt(2)，数值稳定得多。
    const normalize = (list) => {
      const cx = list.reduce((s, p) => s + p.x, 0) / list.length
      const cy = list.reduce((s, p) => s + p.y, 0) / list.length
      const mean = list.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / list.length
      const k = mean > 0 ? Math.SQRT2 / mean : 1
      return { cx, cy, k, matrix: [k, 0, -k * cx, 0, k, -k * cy, 0, 0, 1] }
    }

    const s = normalize(pairs.map((pair) => pair.src))
    const d = normalize(pairs.map((pair) => pair.dst))

    const rows = []
    for (let i = 0; i < pairs.length; i += 1) {
      const sx = (pairs[i].src.x - s.cx) * s.k
      const sy = (pairs[i].src.y - s.cy) * s.k
      const dx = (pairs[i].dst.x - d.cx) * d.k
      const dy = (pairs[i].dst.y - d.cy) * d.k
      rows.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy, dx])
      rows.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy, dy])
    }
    // 高斯消元解 8 个未知数。
    const n = 8
    for (let col = 0; col < n; col += 1) {
      let pivot = col
      for (let r = col + 1; r < n; r += 1) {
        if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r
      }
      const tmp = rows[col]
      rows[col] = rows[pivot]
      rows[pivot] = tmp
      const head = rows[col][col]
      if (Math.abs(head) < 1e-12) throw new Error('单应矩阵奇异：拟合点退化')
      for (let k = col; k <= n; k += 1) rows[col][k] /= head
      for (let r = 0; r < n; r += 1) {
        if (r === col) continue
        const factor = rows[r][col]
        if (factor === 0) continue
        for (let k = col; k <= n; k += 1) rows[r][k] -= factor * rows[col][k]
      }
    }
    const h = rows.map((row) => row[n])
    const H = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
    const composed = mul3(inv3(d.matrix), mul3(H, s.matrix))
    const inverse = inv3(composed)
    return {
      apply(point) {
        const x = point.x
        const y = point.y
        const w = composed[6] * x + composed[7] * y + composed[8]
        return {
          x: (composed[0] * x + composed[1] * y + composed[2]) / w,
          y: (composed[3] * x + composed[4] * y + composed[5]) / w,
        }
      },
      /** 反解：屏幕像素 -> 环平面坐标。 */
      invert(point) {
        const x = point.x
        const y = point.y
        const w = inverse[6] * x + inverse[7] * y + inverse[8]
        return {
          x: (inverse[0] * x + inverse[1] * y + inverse[2]) / w,
          y: (inverse[3] * x + inverse[4] * y + inverse[5]) / w,
        }
      },
    }
  }

  /** 采样一圈，返回投影椭圆的长短半轴、旋转角与中心。 */
  function ellipseOf(fit, radius) {
    const points = []
    for (let i = 0; i < 360; i += 1) {
      const angle = (i / 360) * Math.PI * 2
      const p = fit.apply(planePoint(angle, radius))
      points.push(p)
    }
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length
    let sxx = 0
    let syy = 0
    let sxy = 0
    for (const p of points) {
      const dx = p.x - cx
      const dy = p.y - cy
      sxx += dx * dx
      syy += dy * dy
      sxy += dx * dy
    }
    sxx /= points.length
    syy /= points.length
    sxy /= points.length
    // 协方差矩阵的特征值 -> 椭圆长短半轴。
    const tr = sxx + syy
    const det = sxx * syy - sxy * sxy
    const disc = Math.max(0, (tr * tr) / 4 - det)
    const l1 = tr / 2 + Math.sqrt(disc)
    const l2 = tr / 2 - Math.sqrt(disc)
    const major = 2 * Math.sqrt(Math.max(l1, 1e-9))
    const minor = 2 * Math.sqrt(Math.max(l2, 1e-9))
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    return {
      center: { x: cx, y: cy },
      semiMajor: major / 2,
      semiMinor: minor / 2,
      rotationDeg: (angle * 180) / Math.PI,
      bbox: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
    }
  }

  /**
   * 算几何：必须在入场**结束后**做。
   *
   * 入场期间 root.scale 还在从 0.92 涨到 1，
   * 那时拟合出来的单应矩阵是缩过的，跟最终画面对不上。
   */
  function computeGeometry() {
    // 用标签圆上的点拟合单应：projectLabel 走的是同一套投影。
    const LABEL_R = __dshRing.ORBIT_RADII.label
    const fitAngles = [0, -90 * Math.PI / 180, -200 * Math.PI / 180]
    const pairs = [{ src: { x: 0, y: 0 }, dst: { x: CENTER.x, y: CENTER.y } }]
    for (const angle of fitAngles) {
      pairs.push({ src: planePoint(angle, LABEL_R), dst: rawAt(angle) })
    }
    const fit = fitHomography(pairs)

    // 留一组没参与拟合的角，用来验拟合准不准。
    const checkAngle = -300 * Math.PI / 180
    const check = fit.apply(planePoint(checkAngle, LABEL_R))
    const truth = rawAt(checkAngle)
    const residual = Math.hypot(check.x - truth.x, check.y - truth.y)

    const radii = __dshRing.ORBIT_RADII
    const geometry = {
      size: SIZE,
      center: { x: CENTER.x, y: CENTER.y },
      residual: residual,
      radii: {
        rail: radii.rail,
        tick: radii.tick,
        track: radii.track,
        core: radii.core,
        label: radii.label,
        finOuter: radii.finBase + radii.finHeight,
      },
      ellipses: {
        track: ellipseOf(fit, radii.track),
        core: ellipseOf(fit, radii.core),
        finOuter: ellipseOf(fit, radii.finBase + radii.finHeight),
      },
      labels: [],
      arcs: [],
    }

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i]
      const mid = (segment.from + segment.to) / 2
      const anchor = handle.projectLabel(mid)
      const dx = anchor.x - CENTER.x
      const align = dx > SIZE * 0.12 ? 'left' : dx < -SIZE * 0.12 ? 'right' : 'center'
      geometry.labels.push({
        key: segment.key,
        text: labels[i],
        share: segment.share,
        mid: mid,
        anchor: anchor,
        align: align,
      })
      geometry.arcs.push({
        key: segment.key,
        share: segment.share,
        from: segment.from,
        to: segment.to,
        start: fit.apply(planePoint(segment.from, radii.track)),
        end: fit.apply(planePoint(segment.to, radii.track)),
      })
    }

    window.__geometry = geometry

    /**
     * 量测：把渲染结果和几何约定对一遍。
     *
     * 只看截图是看不出问题的——弧短一点、颜色浅一点、两边粗细不一，
     * 肉眼很难判到底是「几何错了」还是「材质/合成把它改了」。
     *
     * 所以这里拿截图的像素，用同一份单应矩阵反查：
     * 对每个共享角，沿着半径扫一圈，看哪个角度上出现了桶色、出现在哪个半径上、
     * 颜色到底是多少。于是「弧占多少度」「弧有多宽」「颜色被推成什么样」
     * 都变成可复现的数字，而不是感觉。
     *
     * @param {string} dataUrl - 截图的 data URL。
     * @returns {Promise<object>} 量测结果。
     */
    window.__measure = async (dataUrl) => {
      const image = new Image()
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
        image.src = dataUrl
      })
      const off = document.createElement('canvas')
      off.width = SIZE
      off.height = SIZE
      const ctx = off.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(image, 0, 0)
      const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data

      /** 四个桶的目标色（sRGB 0–255）。 */
      const targets = colors.map((hex) => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ])

      /** 取屏幕像素。 */
      const sample = (p) => {
        const x = Math.round(p.x)
        const y = Math.round(p.y)
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null
        const i = (y * SIZE + x) * 4
        return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]
      }

      /**
       * 这个像素是不是某个桶色的原色。
       *
       * 判据不是「最近的颜色」——暗蓝的结构件离蓝色最近，
       * 那样量出来的「蓝弧」会把整圈暗轨都算进去。
       *
       * 改成：像素应该约等于 k × 桶色（k 是亮度）。
       * - k 必须 ≥ 0.85：暗结构是 0.3×蓝，不算。
       * - 残差必须 ≤ 34：被推浅成 #a8c8ff 那种，比例对不上，残差大，不算。
       *
       * 于是「颜色到底准不准」「弧占多少度」都变成可判定的。
       * @param {number[] | null} px - 像素。
       * @returns {{bucket: number, scale: number}} 命中的桶与亮度；不匹配返回 null。
       */
      const solidOf = (px) => {
        if (px === null || px[3] < 200) return null
        let best = null
        for (let k = 0; k < targets.length; k += 1) {
          const t = targets[k]
          const norm = t[0] * t[0] + t[1] * t[1] + t[2] * t[2]
          const scale = (px[0] * t[0] + px[1] * t[1] + px[2] * t[2]) / norm
          if (scale < 0.85) continue
          const dr = px[0] - scale * t[0]
          const dg = px[1] - scale * t[1]
          const db = px[2] - scale * t[2]
          const residual = Math.sqrt(dr * dr + dg * dg + db * db)
          if (residual <= 34 && (best === null || residual < best.residual)) {
            best = { bucket: k, scale: scale, residual: residual }
          }
        }
        return best
      }

      // 逐像素反解：把每个「原色」像素投回环平面，得到它在环上的角度。
      //
      // 为什么不用「按角度网格采样」：网格会从细带之间漏过去，
      // 量出来的覆盖角偏小；而且弧有 z 偏移，采样位置会整体漂。
      // 逐像素反解没有这两个问题。
      const BINS = 720
      const bins = targets.map(() => new Array(BINS).fill(0))
      const colorSum = targets.map(() => ({ sum: [0, 0, 0], count: 0 }))
      const bandSum = targets.map(() => ({ sum: [0, 0, 0], count: 0 }))

      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const i = (y * SIZE + x) * 4
          if (pixels[i + 3] < 200) continue
          const px = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]
          const hit = solidOf(px)
          if (hit === null) continue
          const p = fit.invert({ x: x + 0.5, y: y + 0.5 })
          const r = Math.hypot(p.x, p.y)
          if (r < 0.72 || r > 1.02) continue
          const shared = (((-Math.atan2(p.y, p.x) * 180) / Math.PI) % 360 + 360) % 360
          const acc = colorSum[hit.bucket]
          acc.sum[0] += px[0]
          acc.sum[1] += px[1]
          acc.sum[2] += px[2]
          acc.count += 1
          bins[hit.bucket][Math.floor((shared / 360) * BINS) % BINS] += 1
          // 期望带内的实际颜色：颜色被推浅时，原色匹配会落空，
          // 只有这一项能看出「它到底变成了什么颜色」。
          for (let k = 0; k < segments.length; k += 1) {
            const segment = segments[k]
            if (r < 0.8 || r > 0.92) continue
            if (shared < segment.from * 180 / Math.PI || shared > segment.to * 180 / Math.PI) continue
            const band = bandSum[k]
            band.sum[0] += px[0]
            band.sum[1] += px[1]
            band.sum[2] += px[2]
            band.count += 1
          }
        }
      }

      /**
       * 沿投影法线量一段弧在屏幕上的宽度（px）。
       * @param {number} bucket - 桶下标。
       * @param {number} shared - 共享角（弧度）。
       * @returns {number | null} 宽度；没量到返回 null。
       */
      const widthAt = (bucket, shared) => {
        const p = fit.apply(planePoint(shared, radii.track))
        const q = fit.apply(planePoint(shared + 0.01, radii.track))
        let tx = q.x - p.x
        let ty = q.y - p.y
        const len = Math.hypot(tx, ty) || 1
        tx /= len
        ty /= len
        const nx = -ty
        const ny = tx
        const solidAt = (s) => {
          const x = Math.round(p.x + nx * s)
          const y = Math.round(p.y + ny * s)
          if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false
          const i = (y * SIZE + x) * 4
          if (pixels[i + 3] < 200) return false
          const hit = solidOf([pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]])
          return hit !== null && hit.bucket === bucket
        }
        let seed = -1
        for (let s = -60; s <= 60 && seed < 0; s += 0.5) {
          if (solidAt(s)) seed = s
        }
        if (seed < 0) return null
        let lo = seed
        let hi = seed
        while (lo > -60 && solidAt(lo - 0.5)) lo -= 0.5
        while (hi < 60 && solidAt(hi + 0.5)) hi += 0.5
        return hi - lo
      }

      const arcs = []
      for (let k = 0; k < targets.length; k += 1) {
        const acc = colorSum[k]
        const band = bandSum[k]
        // 所有连续区间：段数多说明弧被什么东西打断了，
        // 只报「最长的一段」会掩盖打断的位置。
        const runs = []
        for (let start = 0; start < BINS; start += 1) {
          if (bins[k][start] === 0) continue
          let len = 0
          while (len < BINS && bins[k][(start + len) % BINS] !== 0) len += 1
          if (len > 0) runs.push({ start: start, len: len })
        }
        runs.sort((a, b) => b.len - a.len)
        const best = runs[0] ?? { start: 0, len: 0 }
        const covered = (best.len / BINS) * 360
        // 在覆盖区间里取样量宽度。
        // 只取中间那一段：两端是弧的端帽，垂直扫描会擦着边走，量出来的宽度会偏小。
        const widths = []
        for (let i = 0; i < 15; i += 1) {
          const frac = 0.1 + (i / 14) * 0.8
          const shared = ((best.start / BINS + frac * (best.len / BINS)) * 360) * Math.PI / 180
          const w = widthAt(k, shared)
          if (w !== null) widths.push(w)
        }
        arcs.push({
          key: 'bucket' + k,
          target: colors[k],
          coveredDeg: covered,
          startDeg: (best.start / BINS) * 360,
          endDeg: ((best.start + best.len) / BINS) * 360,
          runs: runs.slice(0, 4).map((run) => ({
            from: (run.start / BINS) * 360,
            to: ((run.start + run.len) / BINS) * 360,
            deg: (run.len / BINS) * 360,
          })),
          widthMin: widths.length ? Math.min(...widths) : 0,
          widthMax: widths.length ? Math.max(...widths) : 0,
          widthAvg: widths.length ? widths.reduce((s, v) => s + v, 0) / widths.length : 0,
          color: acc.count === 0 ? null : [
            Math.round(acc.sum[0] / acc.count),
            Math.round(acc.sum[1] / acc.count),
            Math.round(acc.sum[2] / acc.count),
          ],
          bandColor: band.count === 0 ? null : [
            Math.round(band.sum[0] / band.count),
            Math.round(band.sum[1] / band.count),
            Math.round(band.sum[2] / band.count),
          ],
        })
      }
      return { size: SIZE, arcs: arcs }
    }
  }

  // 等入场**真的**播完：不按时间等，按帧等。
  //
  // headless 走的是软件渲染（SwiftShader），一帧要几百毫秒；
  // 按时间等 900ms 会截到入场中途，弧还没长完。
  // 这里等的是「有一帧确实画在入场之后」——那一帧里实现已经把弧长定死了。
  let frames = 0
  let done = false
  handle.onFrame(() => {
    frames += 1
    if (done || frames < 2) return
    if (performance.now() - now < 900) return
    computeGeometry()
    done = true
    window.__ready = true
  })
})()
`
}

/** 打包：把实现模块与共用几何一起打成浏览器能直接跑的一包。 */
async function bundle(outFile) {
  await build({
    stdin: {
      contents: [
        "export { createOrbitMatrix, ORBIT_RADII } from './usage-3d.ts'",
        "export { ringSegments, placeRingLabels } from './usage-ring-geometry.ts'",
      ].join('\n'),
      resolveDir: join(root, 'src', 'client'),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: '__dshRing',
    platform: 'browser',
    target: 'es2022',
    minify: false,
    logLevel: 'warning',
  }).then(async (result) => {
    const { writeFile: write } = await import('node:fs/promises')
    await write(outFile, result.outputFiles[0].text, 'utf8')
  })
}

/** 找 Chrome。 */
function findChrome() {
  for (const path of CHROME_CANDIDATES) {
    if (existsSync(path)) return path
  }
  throw new Error('找不到 Chrome：请设置环境变量 CHROME_PATH')
}

/** 最小 CDP 客户端。 */
async function connect(port) {
  let version
  for (let i = 0; i < 150; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/json/version')
      if (response.ok) {
        version = await response.json()
        break
      }
    } catch {
      // 还没起来。
    }
    await sleep(100)
  }
  if (!version) throw new Error('devtools 未就绪')

  const socket = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let nextId = 1
  const pending = new Map()
  const events = []
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id !== undefined) {
      const entry = pending.get(message.id)
      pending.delete(message.id)
      if (entry === undefined) return
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)))
      else entry.resolve(message.result)
      return
    }
    events.push(message)
  })

  const send = (method, params = {}, sessionId) => {
    const id = (nextId += 1)
    const payload = { id, method, params }
    if (sessionId !== undefined) payload.sessionId = sessionId
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify(payload))
    })
  }

  const target = await send('Target.createTarget', { url: 'about:blank' })
  const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
  const session = attached.sessionId
  await send('Page.enable', {}, session)
  await send('Runtime.enable', {}, session)
  await send('Log.enable', {}, session)

  return {
    send,
    events,
    session,
    close() {
      try {
        socket.close()
      } catch {
        // 忽略。
      }
    },
  }
}

/** 主流程。 */
const sizes = process.argv.slice(2).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
if (sizes.length === 0) sizes.push(DEFAULT_SIZE)

const chromePath = findChrome()
const workDir = await mkdtemp(join(tmpdir(), 'dsh-ring-'))
const bundleFile = join(workDir, 'bundle.js')
await bundle(bundleFile)

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;overflow:hidden}
canvas{display:block}
</style></head>
<body>
<canvas id="c"></canvas>
<script src="./bundle.js"></script>
<script>${pageScript(sizes[0])}</script>
</body></html>`
const htmlFile = join(workDir, 'index.html')
await writeFile(htmlFile, html, 'utf8')

const port = 9500 + Math.floor(Math.random() * 400)
const profileDir = join(workDir, 'profile')
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--user-data-dir=' + profileDir,
    '--remote-debugging-port=' + port,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const client = await connect(port)
try {
  const size = sizes[0]
  await client.send(
    'Emulation.setDeviceMetricsOverride',
    { width: size, height: size, deviceScaleFactor: 1, mobile: false },
    client.session,
  )
  // 透明底：截图出来是干净的 PNG，能直接叠到面板底色上。
  await client.send(
    'Emulation.setDefaultBackgroundColorOverride',
    { color: { r: 0, g: 0, b: 0, a: 0 } },
    client.session,
  )

  client.events.length = 0
  await client.send('Page.navigate', { url: 'file:///' + htmlFile.replace(/\\/g, '/') }, client.session)
  const deadline = Date.now() + 30000
  let ready = false
  while (Date.now() < deadline) {
    if (client.events.some((event) => event.method === 'Page.loadEventFired')) break
    await sleep(50)
  }
  while (Date.now() < deadline) {
    const probe = await client.send(
      'Runtime.evaluate',
      { expression: 'window.__ready === true', returnByValue: true },
      client.session,
    )
    if (probe.result && probe.result.value === true) {
      ready = true
      break
    }
    await sleep(120)
  }
  if (!ready) {
    // 把页面的报错打出来：渲染没完成基本都是脚本或 WebGL 的问题。
    for (const event of client.events) {
      if (event.method === 'Runtime.exceptionThrown') {
        const detail = event.params.exceptionDetails
        console.error('[页面异常]', detail.exception?.description ?? detail.text)
      }
      if (event.method === 'Runtime.consoleAPICalled') {
        const text = event.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')
        console.error('[页面日志]', event.params.type, text)
      }
      if (event.method === 'Log.entryAdded') {
        console.error('[页面日志]', event.params.entry.level, event.params.entry.text)
      }
    }
    throw new Error('渲染未在预期时间内完成')
  }

  const evaluated = await client.send(
    'Runtime.evaluate',
    { expression: 'JSON.stringify(window.__geometry)', returnByValue: true },
    client.session,
  )
  const geometry = JSON.parse(evaluated.result.value)

  const shot = await client.send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false, fromSurface: true },
    client.session,
  )

  // 量测：把像素和几何约定对一遍，别靠肉眼判断弧对不对。
  const measured = await client.send(
    'Runtime.evaluate',
    {
      expression:
        'window.__measure(' + JSON.stringify('data:image/png;base64,' + shot.data) + ')',
      awaitPromise: true,
      returnByValue: true,
    },
    client.session,
  )
  const report = measured.result && measured.result.value ? measured.result.value : null

  const outDir = join(root, 'design')
  await mkdir(outDir, { recursive: true })
  const suffix = size === DEFAULT_SIZE ? '' : '-' + size
  const pngPath = join(outDir, 'dsh-cmdkit-ring-3d' + suffix + '.png')
  const jsonPath = join(outDir, 'dsh-cmdkit-ring-3d' + suffix + '.json')
  await writeFile(pngPath, Buffer.from(shot.data, 'base64'))
  await writeFile(jsonPath, JSON.stringify({ ...geometry, measured: report }, null, 2), 'utf8')

  console.log('[render-design-ring] ' + pngPath)
  console.log('[render-design-ring] ' + jsonPath)
  console.log('[render-design-ring] 拟合残差 ' + geometry.residual.toFixed(3) + ' px')
  for (const label of geometry.labels) {
    console.log(
      '  ' + label.text.padStart(4) + '  anchor(' +
      label.anchor.x.toFixed(1) + ', ' + label.anchor.y.toFixed(1) + ')  ' + label.align,
    )
  }
  if (report !== null) {
    console.log('[render-design-ring] 弧量测（覆盖角 / 屏幕宽 px / 原色 / 带内色）')
    if (size < 512) {
      console.log('  ⚠ 画布小于 512px：弧只有几像素宽，抗锯齿后几乎没有「纯桶色」像素，')
      console.log('    覆盖角与宽度会明显偏小。几何自检请看 1024 那一档。')
    }
    const expected = geometry.arcs.map((arc) => arc)
    for (let i = 0; i < report.arcs.length; i += 1) {
      const entry = report.arcs[i]
      const want = expected[i]
      const wantDeg = want !== undefined ? ((want.to - want.from) * 180) / Math.PI : 0
      const wantShare = want !== undefined ? Math.round(want.share * 100) : 0
      const hex = (value) => value === null ? '—' : '#' + value.map((v) => v.toString(16).padStart(2, '0')).join('')
      console.log(
        '  ' + String(i) +
        '  目标 ' + String(wantShare).padStart(2) + '% (' + wantDeg.toFixed(1) + '°)' +
        '  实测 ' + entry.coveredDeg.toFixed(1) + '°' +
        '  宽 ' + entry.widthMin.toFixed(1) + '–' + entry.widthMax.toFixed(1) +
        '  原色 ' + hex(entry.color) +
        '  目标 ' + (entry.target ?? '—'),
      )
      console.log(
        '     期望 ' + (want !== undefined ? ((want.from * 180 / Math.PI).toFixed(1) + '° → ' + (want.to * 180 / Math.PI).toFixed(1) + '°') : '—') +
        '  实际分段 ' + entry.runs.map((run) => run.from.toFixed(0) + '→' + run.to.toFixed(0) + '(' + run.deg.toFixed(0) + '°)').join(' '),
      )
    }
  }
} finally {
  client.close()
  chrome.kill()
}
