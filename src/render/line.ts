import type { Surface, PlotRect } from '../core/pixels'
import type { RGB } from '../core/color'
import { bayer, hash2 } from '../core/dither'
import { mix, darken } from '../core/color'
import { edgeColor, sparkColor } from './fills'

export interface LineTrace {
  color: RGB
  /** Fractional grid row per plot column. */
  row: Float64Array
  alpha: number
}

export interface LineOpts {
  reveal: number
  sparkle: boolean
  seed: number
  /** Comet-trail glow length below the line, in cells. */
  glow?: number
}

export function renderLines(s: Surface, plot: PlotRect, traces: LineTrace[], opts: LineOpts) {
  const revealCols = Math.max(0, Math.min(plot.w, Math.ceil(plot.w * opts.reveal)))
  const glowLen = opts.glow ?? 13

  for (const trace of traces) {
    const bright = edgeColor(trace.color)
    const dark = darken(trace.color, 0.55)
    for (let i = 0; i < revealCols; i++) {
      const x = plot.x0 + i
      const y0 = trace.row[i]
      const yPrev = i > 0 ? trace.row[i - 1] : y0
      const lo = Math.min(y0, yPrev)
      const hi = Math.max(y0, yPrev)

      // solid line body (connects steep segments vertically)
      const yStart = Math.max(plot.y0, Math.floor(lo))
      const yEnd = Math.min(plot.y1 - 1, Math.floor(hi) + 1)
      for (let y = yStart; y <= yEnd; y++) s.px(x, y, bright, trace.alpha)

      // dithered glow trailing downward
      for (let dy = 1; dy <= glowLen; dy++) {
        const y = Math.floor(hi) + 1 + dy
        if (y >= plot.y1) break
        const t = dy / glowLen
        const d = 0.72 * Math.pow(1 - t, 2.1)
        if (d > bayer(x, y)) s.px(x, y, mix(trace.color, dark, t), trace.alpha)
      }
      // faint mist above
      for (let dy = 1; dy <= 2; dy++) {
        const y = Math.floor(lo) - dy
        if (y < plot.y0) break
        if (0.05 * (1 - dy / 3) > bayer(x, y)) s.px(x, y, trace.color, trace.alpha)
      }
    }

    if (opts.sparkle && trace.alpha === 255) {
      const spark = sparkColor(trace.color)
      for (let i = 0; i < revealCols; i++) {
        const x = plot.x0 + i
        if (hash2(x, 3, opts.seed) < 0.006) {
          const y = Math.round(trace.row[i] + 4 + 10 * hash2(x, 4, opts.seed))
          if (y < plot.y1) s.px(x, y, spark, 200)
        }
      }
    }
  }
}
