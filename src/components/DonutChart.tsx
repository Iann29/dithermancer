'use client'
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { BaseChartProps, FillMode, PixelChartHandle, PixelTheme } from '../types'
import { darkTheme, PALETTE } from '../theme'
import { useChartCore, useMorph, fmtDefault, DIM_ALPHA, type DrawEnv } from '../internal/useChart'
import { Legend } from '../internal/Legend'
import { Tooltip, type TipData } from '../internal/Tooltip'
import { type Surface } from '../core/pixels'
import { easeOutQuart } from '../core/anim'
import { hexToRgb } from '../core/color'
import { renderDonut, type DonutSlice } from '../render/donut'

const TAU = Math.PI * 2

export interface DonutDatum {
  label: string
  value: number
  color?: string
  fill?: FillMode
}

export interface DonutChartProps extends BaseChartProps {
  data: DonutDatum[]
  /** Inner hole as a fraction of the outer radius. 0 = pie. Default 0.55. */
  innerRadius?: number
}

interface DonutLayout {
  cx: number
  cy: number
  rOut: number
  rIn: number
  cell: number
  angles: { a0: number; a1: number }[]
}

export const DonutChart = forwardRef<PixelChartHandle, DonutChartProps>(function DonutChart(props, ref) {
  const {
    data,
    innerRadius = 0.55,
    height = 300,
    pixelSize = 3,
    animate = true,
    sparkle = true,
    showLegend = true,
    showTooltip = true,
    formatValue = fmtDefault,
    theme: themeIn,
    className,
    style,
  } = props

  const theme = useMemo<PixelTheme>(() => ({ ...darkTheme, ...themeIn }), [themeIn])
  const slicesDef = useMemo(
    () =>
      data.map((d, i) => ({
        label: d.label,
        colorHex: d.color ?? PALETTE[i % PALETTE.length],
        color: hexToRgb(d.color ?? PALETTE[i % PALETTE.length]),
        fill: d.fill ?? 'dither',
      })),
    [data],
  )
  const matrix = useMemo(() => [data.map((d) => Math.max(0, d.value))], [data])

  const [selected, setSelected] = useState<string | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const [tip, setTip] = useState<TipData | null>(null)
  const hoverRef = useRef<number | null>(null)
  const layoutRef = useRef<DonutLayout | null>(null)

  const core = useChartCore({
    height,
    pixelSize,
    theme,
    animate,
    sparkle,
    revealDur: 950,
    draw: (s, env) => drawImpl(s, env),
  })
  const getShown = useMorph(matrix, core.animator, animate, core.requestDraw)

  function drawImpl(s: Surface, env: DrawEnv) {
    const { cols, rows, cell } = env
    const topPad = showLegend ? Math.round(26 / cell) : Math.round(8 / cell)
    const pad = Math.round(8 / cell)
    const availW = cols - pad * 2
    const availH = rows - topPad - pad
    if (availW < 8 || availH < 8 || data.length === 0) return

    const rOut = Math.min(availW, availH) / 2 - 1
    const rIn = Math.max(0, rOut * Math.max(0, Math.min(0.92, innerRadius)))
    const cx = cols / 2
    const cy = topPad + availH / 2

    const shown = getShown()[0] ?? []
    const total = shown.reduce((a, b) => a + Math.max(0, b), 0)
    const angles: { a0: number; a1: number }[] = []
    let acc = 0
    for (const v of shown) {
      const frac = total > 0 ? Math.max(0, v) / total : 0
      angles.push({ a0: acc * TAU, a1: (acc + frac) * TAU })
      acc += frac
    }
    layoutRef.current = { cx, cy, rOut, rIn, cell, angles }

    const hi = hoverRef.current
    const slices: DonutSlice[] = slicesDef.map((sl, i) => {
      const dim =
        (selectedRef.current !== null && selectedRef.current !== sl.label) ||
        (hi !== null && hi !== i && selectedRef.current === null)
      return {
        color: sl.color,
        fill: sl.fill,
        a0: angles[i].a0,
        a1: angles[i].a1,
        alpha: dim ? DIM_ALPHA + 50 : 255,
        boost: hi === i ? 1 : 0,
      }
    })

    renderDonut(s, slices, {
      cx,
      cy,
      rOut,
      rIn,
      reveal: easeOutQuart(core.stateRef.current.reveal),
      sparkle,
      seed: core.stateRef.current.seed,
    })
  }

  const sliceAt = (clientX: number, clientY: number): number | null => {
    const canvas = core.canvasRef.current
    const lay = layoutRef.current
    if (!canvas || !lay) return null
    const rect = canvas.getBoundingClientRect()
    const x = (clientX - rect.left) / lay.cell
    const y = (clientY - rect.top) / lay.cell
    const dx = x - lay.cx
    const dy = y - lay.cy
    const r = Math.hypot(dx, dy)
    if (r > lay.rOut + 1 || r < lay.rIn - 1) return null
    const rel = (Math.atan2(dy, dx) + Math.PI / 2 + TAU) % TAU
    for (let i = 0; i < lay.angles.length; i++) {
      if (rel >= lay.angles[i].a0 && rel < lay.angles[i].a1) return i
    }
    return null
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const i = sliceAt(e.clientX, e.clientY)
    if (i !== hoverRef.current) {
      hoverRef.current = i
      core.requestDraw()
    }
    if (!showTooltip || i === null) {
      setTip(null)
      return
    }
    const canvas = core.canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    setTip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 8,
      title: data[i].label,
      rows: [
        {
          color: slicesDef[i].colorHex,
          label: data[i].label,
          value: formatValue(data[i].value),
        },
      ],
    })
  }

  const onPointerLeave = () => {
    hoverRef.current = null
    setTip(null)
    core.requestDraw()
  }

  const onClick = (e: React.MouseEvent) => {
    const i = sliceAt(e.clientX, e.clientY)
    if (i === null) {
      setSelected(null)
      return
    }
    setSelected((sel) => (sel === data[i].label ? null : data[i].label))
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
          items={slicesDef.map((s) => ({ key: s.label, label: s.label, colorHex: s.colorHex }))}
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
