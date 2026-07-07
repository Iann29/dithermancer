import type { Surface, PlotRect } from '../core/pixels'
import type { PixelTheme } from '../types'

export interface YAxisSpec {
  ticks: number[]
  /** Map a data value to a fractional grid row. */
  toRow: (v: number) => number
  format: (v: number) => string
}

export function drawYAxis(s: Surface, plot: PlotRect, cell: number, spec: YAxisSpec, theme: PixelTheme) {
  for (const tick of spec.ticks) {
    const row = spec.toRow(tick)
    if (row < plot.y0 - 0.5 || row > plot.y1 + 0.5) continue
    s.text({
      x: plot.x0 * cell - 8,
      y: row * cell + theme.fontSize * 0.34,
      text: spec.format(tick),
      color: theme.axis,
      align: 'right',
    })
  }
}

export interface XLabel {
  col: number
  label: string
}

/** Draw x labels, skipping as needed so they never collide. */
export function drawXLabels(s: Surface, plot: PlotRect, cell: number, labels: XLabel[], theme: PixelTheme) {
  if (!labels.length) return
  const px = (c: number) => c * cell
  const approxW = (t: string) => t.length * theme.fontSize * 0.62
  let step = 1
  const slot = labels.length > 1 ? px(labels[1].col) - px(labels[0].col) : Infinity
  const maxW = Math.max(...labels.map((l) => approxW(l.label)))
  if (slot < maxW + 10) step = Math.ceil((maxW + 10) / Math.max(1, slot))
  const y = plot.y1 * cell + theme.fontSize + 6
  labels.forEach((l, i) => {
    if (i % step !== 0) return
    s.text({ x: px(l.col), y, text: l.label, color: theme.axis, align: 'center' })
  })
}
