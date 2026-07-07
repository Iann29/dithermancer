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
import { renderAreaBands, type AreaBand } from '../render/area'
import { drawYAxis, drawXLabels } from '../render/axes'

export interface AreaChartProps extends CartesianChartProps {
  /** Stack series on top of each other (animates when toggled). */
  stacked?: boolean
  curve?: 'smooth' | 'linear'
}

interface AreaLayout {
  plot: PlotRect
  cell: number
  tipAnchor: { x: number; y: number } | null
  bands: { key: string; top: Float64Array; bottom: Float64Array }[]
}

export const AreaChart = forwardRef<PixelChartHandle, AreaChartProps>(function AreaChart(props, ref) {
  const {
    data,
    series,
    xKey = 'label',
    height = 300,
    pixelSize = 3,
    stacked = false,
    curve = 'smooth',
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

  // Geometry morph state lives in value space: rows [2*si] = lower, [2*si+1] = upper bound.
  const matrix = useMemo(() => {
    const n = data.length
    const rows: number[][] = []
    if (stacked) {
      const cum = new Array(n).fill(0)
      for (const vs of values) {
        const lower = cum.slice()
        for (let i = 0; i < n; i++) cum[i] += vs[i]
        rows.push(lower, cum.slice())
      }
    } else {
      for (const vs of values) rows.push(new Array(n).fill(0), vs.slice())
    }
    return rows
  }, [values, stacked, data.length])

  const yMaxData = useMemo(() => {
    let m = 0
    for (const row of matrix) for (const v of row) m = Math.max(m, v)
    return m
  }, [matrix])

  const [selected, setSelected] = useState<string | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const [tip, setTip] = useState<TipData | null>(null)
  const hoverRef = useRef<number | null>(null)
  const layoutRef = useRef<AreaLayout | null>(null)

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
    const { cols, rows, cell } = env
    const plot = plotRect(cols, rows, cell, {
      left: showAxes ? 38 : 8,
      right: 8,
      top: showLegend ? 26 : 10,
      bottom: showAxes ? 26 : 8,
    })
    const n = data.length
    const layout: AreaLayout = { plot, cell, tipAnchor: null, bands: [] }
    layoutRef.current = layout
    if (n === 0 || S.length === 0 || plot.w < 4) return

    const shown = getShown()
    const yMax = scaleMax(yMaxData)
    const toRow = (v: number) => plot.y1 - 1 - (v / yMax) * (plot.h - 2)
    const colOf = (i: number) =>
      n === 1 ? plot.x0 + plot.w / 2 : plot.x0 + (i * (plot.w - 1)) / (n - 1)
    const xs = Array.from({ length: n }, (_, i) => colOf(i))
    const mkSampler = curve === 'smooth' ? monotoneCubic : linearSampler

    const bands: AreaBand[] = S.map((ser, si) => {
      const fTop = mkSampler(xs, shown[2 * si + 1].map(toRow))
      const fBot = mkSampler(xs, shown[2 * si].map(toRow))
      const top = new Float64Array(plot.w)
      const bottom = new Float64Array(plot.w)
      for (let j = 0; j < plot.w; j++) {
        const x = plot.x0 + j
        const a = fTop(x)
        const b = fBot(x)
        top[j] = Math.min(a, b)
        bottom[j] = Math.max(a, b)
      }
      layout.bands.push({ key: ser.key, top, bottom })
      const dim = selectedRef.current !== null && selectedRef.current !== ser.key
      return { color: ser.color, fill: ser.fill, top, bottom, alpha: dim ? DIM_ALPHA : 255 }
    })

    renderAreaBands(s, plot, bands, {
      reveal: easeOutCubic(core.stateRef.current.reveal),
      sparkle,
      seed: core.stateRef.current.seed,
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
      let minTop = plot.y1
      bands.forEach((b) => {
        if (b.alpha < 255) return
        minTop = Math.min(minTop, b.top[j])
        s.circle({
          x: (x + 0.5) * cell,
          y: b.top[j] * cell,
          r: 3.5,
          stroke: theme.crosshair,
          width: 1.5,
        })
      })
      layout.tipAnchor = { x: (x + 0.5) * cell, y: minTop * cell }
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

  const onClick = (e: React.MouseEvent) => {
    const canvas = core.canvasRef.current
    const lay = layoutRef.current
    const i = indexAt(e.clientX)
    if (!canvas || !lay || i === null) return
    const rect = canvas.getBoundingClientRect()
    const row = (e.clientY - rect.top) / lay.cell
    const col = Math.round((e.clientX - rect.left) / lay.cell)
    const j = Math.max(0, Math.min(lay.plot.w - 1, col - lay.plot.x0))
    for (let bi = lay.bands.length - 1; bi >= 0; bi--) {
      const b = lay.bands[bi]
      if (row >= b.top[j] - 1 && row <= b.bottom[j]) {
        setSelected((sel) => (sel === b.key ? null : b.key))
        return
      }
    }
    setSelected(null)
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
        onClick={onClick}
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
