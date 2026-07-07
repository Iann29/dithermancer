'use client'
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { CartesianChartProps, PixelChartHandle, PixelTheme } from '../types'
import { darkTheme } from '../theme'
import { useChartCore, useMorph, resolveSeries, fmtDefault, DIM_ALPHA, type DrawEnv } from '../internal/useChart'
import { Legend } from '../internal/Legend'
import { Tooltip, type TipData } from '../internal/Tooltip'
import { plotRect, type Surface, type PlotRect } from '../core/pixels'
import { niceTicks, scaleMax } from '../core/scale'
import { easeOutCubic } from '../core/anim'
import { renderBarSegs, type BarSeg } from '../render/bars'
import { drawYAxis, drawXLabels } from '../render/axes'

export interface BarChartProps extends CartesianChartProps {
  /** Stack series in one bar; false = grouped side-by-side (animates when toggled). */
  stacked?: boolean
}

interface BarLayout {
  plot: PlotRect
  cell: number
  tipAnchor: { x: number; y: number } | null
}

export const BarChart = forwardRef<PixelChartHandle, BarChartProps>(function BarChart(props, ref) {
  const {
    data,
    series,
    xKey = 'label',
    height = 300,
    pixelSize = 3,
    stacked = false,
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
  const layoutRef = useRef<BarLayout | null>(null)

  const core = useChartCore({
    height,
    pixelSize,
    theme,
    animate,
    sparkle,
    revealDur: 850,
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
    const layout: BarLayout = { plot, cell, tipAnchor: null }
    layoutRef.current = layout
    if (n === 0 || S.length === 0 || plot.w < 4) return

    const shown = getShown()
    const yMax = scaleMax(yMaxData)
    const baseline = plot.y1 - 1
    const toRow = (v: number) => baseline - (v / yMax) * (plot.h - 2)
    const slotW = plot.w / n
    const groupW = Math.max(3, Math.min(slotW * 0.62, slotW - 2))

    const reveal = core.stateRef.current.reveal
    const span = 0.55
    const hi = hoverRef.current

    const segs: BarSeg[] = []
    let tipTop = baseline
    for (let i = 0; i < n; i++) {
      const delay = n > 1 ? (i / (n - 1)) * (1 - span) : 0
      const p = easeOutCubic(Math.max(0, Math.min(1, (reveal - delay) / span)))
      const center = plot.x0 + (i + 0.5) * slotW
      const hovered = hi === i
      for (let si = 0; si < S.length; si++) {
        const lower = shown[2 * si][i]
        const upper = shown[2 * si + 1][i]
        let x0: number
        let x1: number
        if (stacked) {
          x0 = Math.round(center - groupW / 2)
          x1 = Math.max(x0 + 1, Math.round(center + groupW / 2))
        } else {
          const subW = groupW / S.length
          x0 = Math.round(center - groupW / 2 + si * subW)
          x1 = Math.max(x0 + 1, Math.round(center - groupW / 2 + (si + 1) * subW))
        }
        // grow from the baseline
        const yTop = baseline - (baseline - toRow(upper)) * p
        const yBot = baseline - (baseline - toRow(lower)) * p
        if (hovered && yTop < tipTop) tipTop = yTop
        const dim = selectedRef.current !== null && selectedRef.current !== S[si].key
        segs.push({
          x0,
          x1,
          yTop,
          yBot,
          color: S[si].color,
          fill: S[si].fill,
          alpha: dim ? DIM_ALPHA : 255,
          boost: hovered ? 0.5 : 0,
        })
      }
      if (hovered) layout.tipAnchor = { x: center * cell, y: tipTop * cell }
    }

    renderBarSegs(s, plot, segs, { sparkle, seed: core.stateRef.current.seed })

    if (showAxes) {
      drawYAxis(s, plot, cell, { ticks: niceTicks(0, yMaxData, 4), toRow, format: formatValue }, theme)
      drawXLabels(
        s,
        plot,
        cell,
        labels.map((l, i) => ({ col: plot.x0 + (i + 0.5) * slotW, label: l })),
        theme,
      )
    }
  }

  const indexAt = (clientX: number): number | null => {
    const canvas = core.canvasRef.current
    const lay = layoutRef.current
    const n = data.length
    if (!canvas || !lay || n === 0) return null
    const rect = canvas.getBoundingClientRect()
    const col = (clientX - rect.left) / lay.cell
    const i = Math.floor(((col - lay.plot.x0) / lay.plot.w) * n)
    if (i < 0 || i >= n) return null
    return i
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const i = indexAt(e.clientX)
    if (i === null) {
      onPointerLeave()
      return
    }
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
