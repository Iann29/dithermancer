'use client'
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { CartesianChartProps, PixelChartHandle, PixelTheme } from '../types'
import { darkTheme } from '../theme'
import { useChartCore, useMorph, resolveSeries, DIM_ALPHA, type DrawEnv } from '../internal/useChart'
import { Legend } from '../internal/Legend'
import { type Surface } from '../core/pixels'
import { easeOutCubic } from '../core/anim'
import { renderRadar, radarAngle, type RadarSeriesRender } from '../render/radar'

export interface RadarChartProps extends CartesianChartProps {
  /** Full-scale value at the outer ring. Defaults to the data max. */
  max?: number
  rings?: number
}

export const RadarChart = forwardRef<PixelChartHandle, RadarChartProps>(function RadarChart(props, ref) {
  const {
    data,
    series,
    xKey = 'label',
    max,
    rings = 3,
    height = 300,
    pixelSize = 3,
    animate = true,
    sparkle = true,
    showLegend = true,
    theme: themeIn,
    className,
    style,
  } = props

  const theme = useMemo<PixelTheme>(() => ({ ...darkTheme, ...themeIn }), [themeIn])
  const S = useMemo(() => resolveSeries(series), [series])
  const axesLabels = useMemo(() => data.map((d) => String(d[xKey] ?? '')), [data, xKey])
  const values = useMemo(() => S.map((s) => data.map((d) => Number(d[s.key]) || 0)), [data, S])
  const fullScale = useMemo(
    () => max ?? Math.max(1e-9, ...values.flat()) * 1.05,
    [max, values],
  )

  const [selected, setSelected] = useState<string | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  const core = useChartCore({
    height,
    pixelSize,
    theme,
    animate,
    sparkle,
    revealDur: 800,
    draw: (s, env) => drawImpl(s, env),
  })
  const getShown = useMorph(values, core.animator, animate, core.requestDraw)

  function drawImpl(s: Surface, env: DrawEnv) {
    const { cols, rows, cell } = env
    const K = data.length
    if (K < 3 || S.length === 0) return
    const topPad = (showLegend ? 26 : 8) / cell
    const labelPad = 22 / cell
    const availW = cols - labelPad * 2
    const availH = rows - topPad - labelPad * 1.6
    if (availW < 8 || availH < 8) return

    const R = Math.min(availW, availH) / 2
    const cx = cols / 2
    const cy = topPad + labelPad * 0.3 + availH / 2 + 1

    const shown = getShown()
    const seriesArr: RadarSeriesRender[] = S.map((ser, si) => {
      const dim = selectedRef.current !== null && selectedRef.current !== ser.key
      return {
        color: ser.color,
        fill: ser.fill,
        radii: shown[si].map((v) => (Math.max(0, v) / fullScale) * R),
        alpha: dim ? DIM_ALPHA : 255,
      }
    })

    renderRadar(s, seriesArr, {
      cx,
      cy,
      R,
      reveal: easeOutCubic(core.stateRef.current.reveal),
      webColor: theme.axis,
      rings,
    })

    // axis labels around the web
    for (let k = 0; k < K; k++) {
      const a = radarAngle(k, K)
      const lx = (cx + Math.cos(a) * (R + 3)) * cell
      const ly = (cy + Math.sin(a) * (R + 3)) * cell
      const cos = Math.cos(a)
      const sin = Math.sin(a)
      s.text({
        x: lx + cos * 6,
        y: ly + sin * 8 + (Math.abs(sin) < 0.3 ? 4 : sin > 0 ? 10 : 0),
        text: axesLabels[k],
        color: theme.text,
        align: Math.abs(cos) < 0.35 ? 'center' : cos > 0 ? 'left' : 'right',
      })
    }
  }

  useImperativeHandle(ref, () => ({ replay: core.replay }), [core.replay])

  return (
    <div
      ref={core.containerRef}
      className={className}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      <canvas ref={core.canvasRef} style={{ display: 'block', width: '100%', height }} />
      {showLegend && (
        <Legend
          items={S.map((s) => ({ key: s.key, label: s.label, colorHex: s.colorHex }))}
          selected={selected}
          onToggle={(k) => setSelected((sel) => (sel === k ? null : k))}
          theme={theme}
        />
      )}
    </div>
  )
})
