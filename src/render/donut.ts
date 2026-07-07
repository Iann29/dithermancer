import type { Surface } from '../core/pixels'
import type { RGB } from '../core/color'
import type { FillMode } from '../types'
import { fillCell, edgeColor, sparkColor } from './fills'
import { hash2 } from '../core/dither'
import { lighten } from '../core/color'

const TAU = Math.PI * 2

export interface DonutSlice {
  color: RGB
  fill: FillMode
  /** Start/end angle in radians, 0 = 12 o'clock, increasing clockwise. */
  a0: number
  a1: number
  alpha: number
  boost?: number
}

export interface DonutOpts {
  cx: number
  cy: number
  rOut: number
  rIn: number
  reveal: number
  sparkle: boolean
  seed: number
  /** Gap between slices, in cells of arc length. */
  gap?: number
}

export function renderDonut(s: Surface, slices: DonutSlice[], opts: DonutOpts) {
  const { cx, cy, rOut, rIn } = opts
  const gap = opts.gap ?? 1.6
  const revealAngle = TAU * Math.max(0, Math.min(1, opts.reveal))
  const x0 = Math.max(0, Math.floor(cx - rOut - 1))
  const x1 = Math.min(s.cols - 1, Math.ceil(cx + rOut + 1))
  const y0 = Math.max(0, Math.floor(cy - rOut - 1))
  const y1 = Math.min(s.rows - 1, Math.ceil(cy + rOut + 1))

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const r = Math.hypot(dx, dy)
      if (r > rOut + 0.5 || r < rIn - 0.5) continue
      const rel = (Math.atan2(dy, dx) + Math.PI / 2 + TAU) % TAU
      if (rel > revealAngle) continue

      let slice: DonutSlice | undefined
      for (const sl of slices) {
        if (rel >= sl.a0 && rel < sl.a1) {
          slice = sl
          break
        }
      }
      if (!slice) continue

      // gap between slices (constant arc width)
      const arcToEdge = Math.min(rel - slice.a0, slice.a1 - rel) * r
      if (arcToEdge < gap / 2 && slices.length > 1) continue

      const color = slice.boost ? lighten(slice.color, slice.boost * 0.25) : slice.color
      if (rOut - r < 1.7) {
        s.px(x, y, edgeColor(color), slice.alpha)
      } else {
        const t = Math.min(1, (rOut - r) / Math.max(1, rOut - rIn))
        // keep the ring meaty: stay dense for most of the band, thin out near the hole
        fillCell(s, x, y, Math.pow(t, 1.6), slice.fill, color, slice.alpha)
      }

      if (opts.sparkle && slice.alpha === 255 && hash2(x, y, opts.seed) < 0.0012) {
        s.px(x, y, sparkColor(color), 210)
      }
    }
  }
}
