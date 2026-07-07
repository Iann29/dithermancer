'use client'
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { CartesianChartProps, PixelChartHandle, PixelTheme } from '../types'
import { darkTheme } from '../theme'
import { useChartCore, useMorph, resolveSeries, fmtDefault, DIM_ALPHA, type DrawEnv } from '../internal/useChart'
import { Legend } from '../internal/Legend'
import { Tooltip, type TipData } from '../internal/Tooltip'
import { plotRect, type Surface, type PlotRect } from '../core/pixels'
import { monotoneCubic, linearSampler } from '../core/curve'
import { niceTicks, scaleMax } from '../core/scale'
import { easeOutCubic } from '../core/anim'
import { hexToRgb } from '../core/color'
import { renderLines, type LineTrace } from '../render/line'
import { drawYAxis, drawXLabels } from '../render/axes'

export interface LineChartProps extends CartesianChartProps {
  curve?: 'smooth' | 'linear'
  /** Length of the dithered glow trailing under the line, in pixels-cells. */
  glow?: number
}

interface LineLayout {
  plot: PlotRect
  cell: number
  tipAnchor: { x: number; y: number } | null
}

export const LineChart = forwardRef<PixelChartHandle, LineChartProps>(function LineChart(props, ref) {
  const {
    data,
    series,
    xKey = 'label',
    height = 300,
    pixelSize = 3,
    curve = 'smooth',
    glow = 13,
    animate = true,
    sparkle = true,
    showLegend = true,
    showTooltip = true,
    showAxes = true,
    formatValue = fmtDefault,
    theme: themeIn,
    className,
    style,
  } = props

  const theme = useMemo<PixelTheme>(() => ({ ...darkTheme, ...themeIn }), [themeIn])
  const S = useMemo(() => resolveSeries(series), [series])
  const labels = useMemo(() => data.map((d) => String(d[xKey] ?? '')), [data, xKey])
  const values = useMemo(() => S.map((s) => data.map((d) => Number(d[s.key]) || 0)), [data, S])
  const yMaxData = useMemo(() => Math.max(1e-9, ...values.flat()), [values])

  const [selected, setSelected] = useState<string | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const [tip, setTip] = useState<TipData | null>(null)
  const hoverRef = useRef<number | null>(null)
  const layoutRef = useRef<LineLayout | null>(null)

  const core = useChartCore({
    height,
    pixelSize,
    theme,
    animate,
    sparkle,
    revealDur: 900,
    draw: (s, env) => drawImpl(s, env),
  })
  const getShown = useMorph(values, core.animator, animate, core.requestDraw)

  function drawImpl(s: Surface, env: DrawEnv) {
    const { cols, rows, cell } = env
    const plot = plotRect(cols, rows, cell, {
      left: showAxes ? 38 : 8,
      right: 8,
      top: showLegend ? 26 : 10,
      bottom: showAxes ? 26 : 8,
    })
    const n = data.length
    const layout: LineLayout = { plot, cell, tipAnchor: null }
    layoutRef.current = layout
    if (n === 0 || S.length === 0 || plot.w < 4) return

    const shown = getShown()
    const yMax = scaleMax(yMaxData)
    const toRow = (v: number) => plot.y1 - 1 - (v / yMax) * (plot.h - 2)
    const colOf = (i: number) =>
      n === 1 ? plot.x0 + plot.w / 2 : plot.x0 + (i * (plot.w - 1)) / (n - 1)
    const xs = Array.from({ length: n }, (_, i) => colOf(i))
    const mkSampler = curve === 'smooth' ? monotoneCubic : linearSampler

    const traces: LineTrace[] = S.map((ser, si) => {
      const f = mkSampler(xs, shown[si].map(toRow))
      const row = new Float64Array(plot.w)
      for (let j = 0; j < plot.w; j++) row[j] = f(plot.x0 + j)
      const dim = selectedRef.current !== null && selectedRef.current !== ser.key
      return { color: ser.color, row, alpha: dim ? DIM_ALPHA : 255 }
    })

    renderLines(s, plot, traces, {
      reveal: easeOutCubic(core.stateRef.current.reveal),
      sparkle,
      seed: core.stateRef.current.seed,
      glow,
    })

    if (showAxes) {
      drawYAxis(s, plot, cell, { ticks: niceTicks(0, yMaxData, 4), toRow, format: formatValue }, theme)
      drawXLabels(s, plot, cell, labels.map((l, i) => ({ col: colOf(i), label: l })), theme)
    }

    const hi = hoverRef.current
    if (hi !== null && hi >= 0 && hi < n) {
      const x = Math.round(colOf(hi))
      const ch = hexToRgb(theme.crosshair)
      for (let y = plot.y0; y < plot.y1; y++) s.px(x, y, ch, 80)
      const j = Math.max(0, Math.min(plot.w - 1, x - plot.x0))
      let minRow = plot.y1
      traces.forEach((t) => {
        if (t.alpha < 255) return
        minRow = Math.min(minRow, t.row[j])
        s.circle({
          x: (x + 0.5) * cell,
          y: t.row[j] * cell,
          r: 3.5,
          stroke: theme.crosshair,
          width: 1.5,
        })
      })
      layout.tipAnchor = { x: (x + 0.5) * cell, y: minRow * cell }
    }
  }

  const indexAt = (clientX: number): number | null => {
    const canvas = core.canvasRef.current
    const lay = layoutRef.current
    const n = data.length
    if (!canvas || !lay || n === 0) return null
    const rect = canvas.getBoundingClientRect()
    const col = (clientX - rect.left) / lay.cell
    const step = n > 1 ? (lay.plot.w - 1) / (n - 1) : 1
    return Math.max(0, Math.min(n - 1, Math.round((col - lay.plot.x0) / step)))
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const i = indexAt(e.clientX)
    if (i === null) return
    hoverRef.current = i
    core.requestDraw()
    if (!showTooltip) return
    const anchor = layoutRef.current?.tipAnchor
    if (!anchor) return
    setTip({
      x: anchor.x,
      y: anchor.y,
      title: labels[i],
      rows: S.map((ser, si) => ({ ser, si }))
        .filter(({ ser }) => selected === null || selected === ser.key)
        .map(({ ser, si }) => ({
          color: ser.colorHex,
          label: ser.label,
          value: formatValue(values[si][i]),
        })),
    })
  }

  const onPointerLeave = () => {
    hoverRef.current = null
    setTip(null)
    core.requestDraw()
  }

  useImperativeHandle(ref, () => ({ replay: core.replay }), [core.replay])

  return (
    <div
      ref={core.containerRef}
      className={className}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      <canvas
        ref={core.canvasRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={{ display: 'block', width: '100%', height }}
      />
      {showLegend && (
        <Legend
          items={S.map((s) => ({ key: s.key, label: s.label, colorHex: s.colorHex }))}
          selected={selected}
          onToggle={(k) => setSelected((sel) => (sel === k ? null : k))}
          theme={theme}
        />
      )}
      {showTooltip && tip && (
        <Tooltip
          tip={tip}
          theme={theme}
          containerW={core.containerRef.current?.clientWidth ?? 400}
        />
      )}
    </div>
  )
})
