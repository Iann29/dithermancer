'use client'
import { forwardRef, useImperativeHandle, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { Datum, FillMode, PixelChartHandle, PixelTheme } from '../types'
import { darkTheme, PALETTE } from '../theme'
import { useChartCore, useMorph, type DrawEnv } from '../internal/useChart'
import { type Surface } from '../core/pixels'
import { monotoneCubic, linearSampler } from '../core/curve'
import { easeOutCubic } from '../core/anim'
import { hexToRgb } from '../core/color'
import { renderAreaBands } from '../render/area'

export interface SparklineProps {
  /** Plain numbers, or objects read via `dataKey`. */
  data: number[] | Datum[]
  /** Field to read when `data` is an object array. Default "value". */
  dataKey?: string
  color?: string
  fill?: FillMode
  height?: number
  pixelSize?: number
  curve?: 'smooth' | 'linear'
  animate?: boolean
  sparkle?: boolean
  theme?: Partial<PixelTheme>
  className?: string
  style?: CSSProperties
}

/** Mini dithered area — no axes, no legend, no tooltip. Fits cards, tables, headers. */
export const Sparkline = forwardRef<PixelChartHandle, SparklineProps>(function Sparkline(props, ref) {
  const {
    data,
    dataKey = 'value',
    color = PALETTE[0],
    fill = 'dither',
    height = 64,
    pixelSize = 3,
    curve = 'smooth',
    animate = true,
    sparkle = true,
    theme: themeIn,
    className,
    style,
  } = props

  const theme = useMemo<PixelTheme>(() => ({ ...darkTheme, ...themeIn }), [themeIn])
  const rgb = useMemo(() => hexToRgb(color), [color])
  const values = useMemo(
    () =>
      data.map((d) =>
        typeof d === 'number' ? d : Number((d as Datum)[dataKey]) || 0,
      ),
    [data, dataKey],
  )
  const matrix = useMemo(() => [values], [values])

  const core = useChartCore({
    height,
    pixelSize,
    theme,
    animate,
    sparkle,
    revealDur: 900,
    draw: (s, env) => drawImpl(s, env),
  })
  const getShown = useMorph(matrix, core.animator, animate, core.requestDraw)

  function drawImpl(s: Surface, env: DrawEnv) {
    const { cols, rows } = env
    const n = values.length
    if (n === 0 || cols < 4) return
    const shown = getShown()[0]
    const max = Math.max(1e-9, ...values) * 1.04

    // full-bleed plot: 1 cell of headroom, baseline on the last row
    const plot = { x0: 0, y0: 1, x1: cols, y1: rows, w: cols, h: rows - 1 }
    const toRow = (v: number) => plot.y1 - 1 - (v / max) * (plot.h - 2)
    const colOf = (i: number) => (n === 1 ? cols / 2 : (i * (cols - 1)) / (n - 1))
    const xs = Array.from({ length: n }, (_, i) => colOf(i))
    const f = (curve === 'smooth' ? monotoneCubic : linearSampler)(xs, shown.map(toRow))

    const top = new Float64Array(plot.w)
    const bottom = new Float64Array(plot.w)
    for (let j = 0; j < plot.w; j++) {
      top[j] = f(j)
      bottom[j] = plot.y1
    }

    renderAreaBands(s, plot, [{ color: rgb, fill, top, bottom, alpha: 255 }], {
      reveal: easeOutCubic(core.stateRef.current.reveal),
      sparkle,
      seed: core.stateRef.current.seed,
    })
  }

  useImperativeHandle(ref, () => ({ replay: core.replay }), [core.replay])

  return (
    <div
      ref={core.containerRef}
      className={className}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      <canvas ref={core.canvasRef} style={{ display: 'block', width: '100%', height }} />
    </div>
  )
})
