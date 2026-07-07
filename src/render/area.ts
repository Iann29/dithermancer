import type { Surface, PlotRect } from '../core/pixels'
import type { RGB } from '../core/color'
import type { FillMode } from '../types'
import { fillCell, edgeColor, sparkColor } from './fills'
import { hash2 } from '../core/dither'

export interface AreaBand {
  color: RGB
  fill: FillMode
  /** Fractional grid row of the band's top/bottom, one entry per plot column. */
  top: Float64Array
  bottom: Float64Array
  alpha: number
}

export interface AreaOpts {
  reveal: number
  sparkle: boolean
  seed: number
}

export function renderAreaBands(s: Surface, plot: PlotRect, bands: AreaBand[], opts: AreaOpts) {
  const revealCols = Math.max(0, Math.min(plot.w, Math.ceil(plot.w * opts.reveal)))

  for (const band of bands) {
    const edge = edgeColor(band.color)
    for (let i = 0; i < revealCols; i++) {
      const x = plot.x0 + i
      const top = band.top[i]
      const bot = band.bottom[i]
      const h = bot - top
      if (h < 0.05) continue
      const yStart = Math.max(plot.y0, Math.floor(top))
      const yEnd = Math.min(plot.y1 - 1, Math.ceil(bot) - 1)
      for (let y = yStart; y <= yEnd; y++) {
        if (y - top < 1.5) {
          s.px(x, y, edge, band.alpha)
        } else {
          const t = Math.min(1, (y - top) / Math.max(1, h))
          fillCell(s, x, y, t, band.fill, band.color, band.alpha)
        }
      }
    }

    // Scan line at the reveal boundary — a bright vertical sweep edge.
    if (opts.reveal < 1 && revealCols > 0) {
      const i = revealCols - 1
      const x = plot.x0 + i
      const yStart = Math.max(plot.y0, Math.floor(band.top[i]))
      const yEnd = Math.min(plot.y1 - 1, Math.ceil(band.bottom[i]) - 1)
      for (let y = yStart; y <= yEnd; y++) s.px(x, y, edge, band.alpha)
    }
  }

  if (!opts.sparkle) return
  for (const band of bands) {
    if (band.alpha < 255) continue
    const spark = sparkColor(band.color)
    for (let i = 0; i < revealCols; i++) {
      const x = plot.x0 + i
      const r = hash2(x, bands.indexOf(band) * 7919, opts.seed)
      const h = band.bottom[i] - band.top[i]
      if (h < 3) continue
      if (r < 0.01) {
        const y = Math.round(band.top[i] + h * hash2(x, 1, opts.seed))
        s.px(x, y, spark, 210)
      } else if (r > 0.996) {
        // stray pixel floating just above the edge
        const y = Math.round(band.top[i] - 2 - 3 * hash2(x, 2, opts.seed))
        if (y >= plot.y0) s.px(x, y, spark, 160)
      }
    }
  }
}
