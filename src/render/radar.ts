import type { Surface } from '../core/pixels'
import type { RGB } from '../core/color'
import type { FillMode } from '../types'
import { fillCell, edgeColor } from './fills'
import { bayer } from '../core/dither'
import { hexToRgb } from '../core/color'

const TAU = Math.PI * 2

export interface RadarSeriesRender {
  color: RGB
  fill: FillMode
  /** Radius (in cells) at each axis, ordered. */
  radii: number[]
  alpha: number
}

export interface RadarOpts {
  cx: number
  cy: number
  /** Full-scale radius in cells. */
  R: number
  reveal: number
  webColor: string
  rings?: number
}

/** Axis angle k of K, starting at 12 o'clock, clockwise (screen coords). */
export function radarAngle(k: number, K: number): number {
  return -Math.PI / 2 + (k / K) * TAU
}

/** Boundary radius of the series polygon along direction `theta` (screen angle). */
function boundaryRadius(radii: number[], theta: number): number {
  const K = radii.length
  const rel = (theta + Math.PI / 2 + TAU) % TAU
  const sector = Math.min(K - 1, Math.floor((rel / TAU) * K))
  const k1 = sector
  const k2 = (sector + 1) % K
  const a1 = radarAngle(k1, K)
  const a2 = radarAngle(k2, K)
  const p1x = Math.cos(a1) * radii[k1]
  const p1y = Math.sin(a1) * radii[k1]
  const p2x = Math.cos(a2) * radii[k2]
  const p2y = Math.sin(a2) * radii[k2]
  const ex = p2x - p1x
  const ey = p2y - p1y
  const dx = Math.cos(theta)
  const dy = Math.sin(theta)
  const denom = dx * ey - dy * ex
  if (Math.abs(denom) < 1e-9) return Math.min(radii[k1], radii[k2])
  const t = (p1x * ey - p1y * ex) / denom
  return Math.max(0, t)
}

export function renderRadar(s: Surface, seriesArr: RadarSeriesRender[], opts: RadarOpts) {
  const { cx, cy, R } = opts
  const rings = opts.rings ?? 3
  const web = hexToRgb(opts.webColor)
  const K = seriesArr.length ? seriesArr[0].radii.length : 0
  const x0 = Math.max(0, Math.floor(cx - R - 2))
  const x1 = Math.min(s.cols - 1, Math.ceil(cx + R + 2))
  const y0 = Math.max(0, Math.floor(cy - R - 2))
  const y1 = Math.min(s.rows - 1, Math.ceil(cy + R + 2))

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const r = Math.hypot(dx, dy)
      if (r > R + 1.5) continue
      const theta = Math.atan2(dy, dx)

      // web: concentric ring polygons + spokes, faint dotted gray
      let webOn = false
      if (K >= 3) {
        const ringR = boundaryRadius(new Array(K).fill(R) as number[], theta)
        for (let g = 1; g <= rings; g++) {
          const rr = (ringR * g) / rings
          if (Math.abs(r - rr) < 0.6) webOn = true
        }
        if (!webOn && r <= ringR) {
          for (let k = 0; k < K; k++) {
            const a = radarAngle(k, K)
            let da = Math.abs(theta - a) % TAU
            da = Math.min(da, TAU - da)
            if (da * r < 0.55) webOn = true
          }
        }
      }
      if (webOn && bayer(x, y) < 0.4) s.px(x, y, web, 130)

      for (const ser of seriesArr) {
        const rB = boundaryRadius(ser.radii, theta) * opts.reveal
        if (rB < 0.5) continue
        if (Math.abs(r - rB) < 1.1) {
          s.px(x, y, edgeColor(ser.color), ser.alpha)
        } else if (r < rB) {
          const t = 1 - r / rB
          fillCell(s, x, y, t, ser.fill, ser.color, ser.alpha)
        }
      }
    }
  }
}
