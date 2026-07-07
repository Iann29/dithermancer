'use client'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Datum, FillMode, PixelChartHandle, PixelTheme } from '../types'
import { darkTheme, PALETTE } from '../theme'
import { easeOutCubic, prefersReducedMotion } from '../core/anim'
import { Sparkline } from './Sparkline'

export interface StatCardProps {
  title: ReactNode
  value: number
  /** Change vs. the previous period; renders ▲/▼ by sign. */
  delta?: number
  /** Which direction is "good" (colors the delta). Default 'up'. */
  deltaGood?: 'up' | 'down'
  /** Force the delta color (overrides deltaGood logic). */
  deltaColor?: string
  /** Sparkline data for the card footer. Omit for a plain card. */
  data?: number[] | Datum[]
  dataKey?: string
  /** Sparkline color. */
  color?: string
  fill?: FillMode
  curve?: 'smooth' | 'linear'
  /** Sparkline height in px. */
  sparkHeight?: number
  pixelSize?: number
  /** Count the number up on mount / when it changes. */
  countUp?: boolean
  animate?: boolean
  sparkle?: boolean
  formatValue?: (v: number) => string
  theme?: Partial<PixelTheme>
  className?: string
  style?: CSSProperties
}

const GOOD = '#2fd66c'
const BAD = '#f05959'

/** KPI tile: title, big animated number, delta chip, dithered sparkline footer. */
export const StatCard = forwardRef<PixelChartHandle, StatCardProps>(function StatCard(props, ref) {
  const {
    title,
    value,
    delta,
    deltaGood = 'up',
    deltaColor,
    data,
    dataKey,
    color = PALETTE[0],
    fill = 'dither',
    curve = 'smooth',
    sparkHeight = 64,
    pixelSize = 3,
    countUp = true,
    animate = true,
    sparkle = true,
    formatValue = (v) => Math.round(v).toLocaleString(),
    theme: themeIn,
    className,
    style,
  } = props

  const theme = useMemo<PixelTheme>(() => ({ ...darkTheme, ...themeIn }), [themeIn])
  const sparkRef = useRef<PixelChartHandle>(null)
  const [hover, setHover] = useState(false)
  const [shown, setShown] = useState(() => (animate && countUp ? 0 : value))
  const shownRef = useRef(shown)
  shownRef.current = shown
  const [runKey, setRunKey] = useState(0)

  useEffect(() => {
    if (!animate || !countUp || prefersReducedMotion()) {
      setShown(value)
      return
    }
    const from = shownRef.current
    if (from === value) return
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 900)
      setShown(from + (value - from) * easeOutCubic(p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, animate, countUp, runKey])

  useImperativeHandle(
    ref,
    () => ({
      replay: () => {
        setShown(0)
        shownRef.current = 0
        setRunKey((k) => k + 1)
        sparkRef.current?.replay()
      },
    }),
    [],
  )

  const up = (delta ?? 0) >= 0
  const good = deltaGood === 'up' ? up : !up
  const dColor = deltaColor ?? (good ? GOOD : BAD)

  return (
    <div
      className={className}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 14,
        border: `1px solid ${hover ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
        background: 'rgba(255,255,255,0.015)',
        overflow: 'hidden',
        transition: 'border-color 160ms linear',
        ...style,
      }}
    >
      <div style={{ padding: '16px 18px 0' }}>
        <div style={{ color: theme.text, fontSize: 14, lineHeight: 1.2 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
          <span
            style={{
              color: theme.tooltipText,
              fontSize: 34,
              fontWeight: 700,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatValue(shown)}
          </span>
          {delta !== undefined && (
            <span style={{ color: dColor, fontSize: 13, fontWeight: 600 }}>
              <span style={{ fontSize: 9, marginRight: 3, verticalAlign: '10%' }}>
                {up ? '▲' : '▼'}
              </span>
              {formatValue(Math.abs(delta))}
            </span>
          )}
        </div>
      </div>
      {data && data.length > 0 && (
        <Sparkline
          ref={sparkRef}
          data={data}
          dataKey={dataKey}
          color={color}
          fill={fill}
          curve={curve}
          height={sparkHeight}
          pixelSize={pixelSize}
          animate={animate}
          sparkle={sparkle}
          theme={themeIn}
          style={{ marginTop: 14 }}
        />
      )}
    </div>
  )
})
