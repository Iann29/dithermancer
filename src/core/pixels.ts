import type { RGB } from './color'

export interface TextOp {
  /** CSS px coordinates relative to the canvas. */
  x: number
  y: number
  text: string
  color: string
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  size?: number
}

export interface CircleOp {
  x: number
  y: number
  r: number
  stroke: string
  width: number
}

/**
 * Low-resolution RGBA buffer — one entry per "chunky pixel" cell.
 * Renderers write cells; `paintSurface` scales it up with smoothing off.
 */
export class Surface {
  readonly cols: number
  readonly rows: number
  readonly data: Uint8ClampedArray
  texts: TextOp[] = []
  circles: CircleOp[] = []

  constructor(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    this.data = new Uint8ClampedArray(cols * rows * 4)
  }

  clear() {
    this.data.fill(0)
    this.texts = []
    this.circles = []
  }

  /** Write one cell (src-over blend when a < 255). */
  px(x: number, y: number, c: RGB, a = 255) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return
    const i = ((y | 0) * this.cols + (x | 0)) * 4
    const d = this.data
    if (a >= 255) {
      d[i] = c[0]
      d[i + 1] = c[1]
      d[i + 2] = c[2]
      d[i + 3] = 255
    } else {
      const sa = a / 255
      const da = d[i + 3] / 255
      const oa = sa + da * (1 - sa)
      if (oa <= 0) return
      d[i] = Math.round((c[0] * sa + d[i] * da * (1 - sa)) / oa)
      d[i + 1] = Math.round((c[1] * sa + d[i + 1] * da * (1 - sa)) / oa)
      d[i + 2] = Math.round((c[2] * sa + d[i + 2] * da * (1 - sa)) / oa)
      d[i + 3] = Math.round(oa * 255)
    }
  }

  text(op: TextOp) {
    this.texts.push(op)
  }

  circle(op: CircleOp) {
    this.circles.push(op)
  }
}

export interface PaintCache {
  off?: HTMLCanvasElement
  imageData?: ImageData
}

export interface PaintOpts {
  /** CSS px size of one cell. */
  cell: number
  dpr: number
  cssW: number
  cssH: number
  font: string
  fontSize: number
}

/** Blit the low-res surface onto the visible canvas, then draw crisp text/markers on top. */
export function paintSurface(
  canvas: HTMLCanvasElement,
  s: Surface,
  cache: PaintCache,
  opts: PaintOpts,
) {
  const { cell, dpr, cssW, cssH, font, fontSize } = opts
  const w = Math.max(1, Math.round(cssW * dpr))
  const h = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (!cache.off || cache.off.width !== s.cols || cache.off.height !== s.rows) {
    cache.off = document.createElement('canvas')
    cache.off.width = s.cols
    cache.off.height = s.rows
    cache.imageData = undefined
  }
  const offCtx = cache.off.getContext('2d')
  if (!offCtx) return
  if (!cache.imageData) cache.imageData = offCtx.createImageData(s.cols, s.rows)
  cache.imageData.data.set(s.data)
  offCtx.putImageData(cache.imageData, 0, 0)

  ctx.clearRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(cache.off, 0, 0, s.cols, s.rows, 0, 0, s.cols * cell * dpr, s.rows * cell * dpr)

  for (const t of s.texts) {
    ctx.font = `${(t.size ?? fontSize) * dpr}px ${font}`
    ctx.fillStyle = t.color
    ctx.textAlign = t.align ?? 'left'
    ctx.textBaseline = t.baseline ?? 'alphabetic'
    ctx.fillText(t.text, t.x * dpr, t.y * dpr)
  }

  for (const c of s.circles) {
    ctx.beginPath()
    ctx.strokeStyle = c.stroke
    ctx.lineWidth = c.width * dpr
    ctx.arc(c.x * dpr, c.y * dpr, c.r * dpr, 0, Math.PI * 2)
    ctx.stroke()
  }
}

export interface PlotRect {
  x0: number
  y0: number
  x1: number
  y1: number
  w: number
  h: number
}

/** Plot area in grid cells given CSS-px margins. */
export function plotRect(
  cols: number,
  rows: number,
  cell: number,
  m: { left: number; right: number; top: number; bottom: number },
): PlotRect {
  const x0 = Math.round(m.left / cell)
  const y0 = Math.round(m.top / cell)
  const x1 = Math.max(x0 + 1, cols - Math.round(m.right / cell))
  const y1 = Math.max(y0 + 1, rows - Math.round(m.bottom / cell))
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}
