import type { Surface, PlotRect } from '../core/pixels'
import type { RGB } from '../core/color'
import type { FillMode } from '../types'
import { fillCell, edgeColor, sparkColor } from './fills'
import { hash2 } from '../core/dither'
import { lighten } from '../core/color'

export interface BarSeg {
  /** Grid-cell bounds. x1/yBot exclusive-ish (floats allowed vertically). */
  x0: number
  x1: number
  yTop: number
  yBot: number
  color: RGB
  fill: FillMode
  alpha: number
  /** Extra brightness boost 0..1 for hover. */
  boost?: number
}

export function renderBarSegs(s: Surface, plot: PlotRect, segs: BarSeg[], opts: { sparkle: boolean; seed: number }) {
  for (const seg of segs) {
    const h = seg.yBot - seg.yTop
    if (h < 0.05) continue
    const color = seg.boost ? lighten(seg.color, seg.boost * 0.18) : seg.color
    const edge = edgeColor(color)
    const yStart = Math.max(plot.y0, Math.floor(seg.yTop))
    const yEnd = Math.min(plot.y1 - 1, Math.ceil(seg.yBot) - 1)
    for (let x = seg.x0; x < seg.x1; x++) {
      for (let y = yStart; y <= yEnd; y++) {
        if (y - seg.yTop < 1.5) {
          s.px(x, y, edge, seg.alpha)
        } else {
          const t = Math.min(1, (y - seg.yTop) / Math.max(1, h))
          fillCell(s, x, y, t, seg.fill, color, seg.alpha)
        }
      }
    }
    if (opts.sparkle && seg.alpha === 255 && h > 5) {
      const spark = sparkColor(color)
      for (let x = seg.x0; x < seg.x1; x++) {
        if (hash2(x, yStart, opts.seed) < 0.02) {
          const y = Math.round(seg.yTop + h * hash2(x, yStart + 1, opts.seed))
          if (y >= yStart && y <= yEnd) s.px(x, y, spark, 210)
        }
      }
    }
  }
}
