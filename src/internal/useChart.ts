import { useCallback, useEffect, useRef } from 'react'
import { Animator, easeOutBack } from '../core/anim'
import { Surface, paintSurface, type PaintCache } from '../core/pixels'
import { hexToRgb } from '../core/color'
import { PALETTE } from '../theme'
import type { PixelTheme, ResolvedSeries, SeriesDef } from '../types'

export interface DrawEnv {
  cols: number
  rows: number
  cell: number
  cssW: number
  cssH: number
}

export interface ChartCoreOpts {
  height: number
  pixelSize: number
  theme: PixelTheme
  animate: boolean
  sparkle: boolean
  revealDur: number
  draw: (s: Surface, env: DrawEnv) => void
}

export function useChartCore(opts: ChartCoreOpts) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animatorRef = useRef<Animator | null>(null)
  if (!animatorRef.current) animatorRef.current = new Animator()
  const animator = animatorRef.current

  const cacheRef = useRef<PaintCache>({})
  const surfRef = useRef<Surface | null>(null)
  const stateRef = useRef({ reveal: opts.animate ? 0 : 1, seed: 0, visible: true })
  const optsRef = useRef(opts)
  optsRef.current = opts

  const requestDraw = useCallback(() => {
    const canvas = canvasRef.current
    const cont = containerRef.current
    if (!canvas || !cont) return
    const cssW = cont.clientWidth
    if (cssW < 10) return
    const o = optsRef.current
    const cell = Math.max(1, o.pixelSize)
    const cols = Math.max(4, Math.floor(cssW / cell))
    const rows = Math.max(4, Math.floor(o.height / cell))
    let surf = surfRef.current
    if (!surf || surf.cols !== cols || surf.rows !== rows) {
      surf = new Surface(cols, rows)
      surfRef.current = surf
    }
    surf.clear()
    o.draw(surf, { cols, rows, cell, cssW, cssH: o.height })
    paintSurface(canvas, surf, cacheRef.current, {
      cell,
      dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      cssW,
      cssH: o.height,
      font: o.theme.font,
      fontSize: o.theme.fontSize,
    })
  }, [])

  const replay = useCallback(() => {
    stateRef.current.reveal = 0
    // Linear progress — each chart applies its own easing/stagger.
    animator.run('reveal', optsRef.current.revealDur, (t) => t, (p) => {
      stateRef.current.reveal = p
      requestDraw()
    })
  }, [animator, requestDraw])

  // mount: intro animation (or straight draw)
  useEffect(() => {
    if (optsRef.current.animate) replay()
    else {
      stateRef.current.reveal = 1
      requestDraw()
    }
    return () => animator.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // follow container size
  useEffect(() => {
    const cont = containerRef.current
    if (!cont || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => requestDraw())
    ro.observe(cont)
    return () => ro.disconnect()
  }, [requestDraw])

  // sparkle twinkle — paused when offscreen or tab hidden
  useEffect(() => {
    if (!opts.sparkle) return
    animator.interval('twinkle', 500, () => {
      if (!stateRef.current.visible) return
      if (typeof document !== 'undefined' && document.hidden) return
      stateRef.current.seed++
      requestDraw()
    })
    return () => animator.stop('twinkle')
  }, [opts.sparkle, animator, requestDraw])

  useEffect(() => {
    const cont = containerRef.current
    if (!cont || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      stateRef.current.visible = entries[0]?.isIntersecting ?? true
    })
    io.observe(cont)
    return () => io.disconnect()
  }, [])

  // repaint after every React render so prop/state changes always land
  useEffect(() => {
    requestDraw()
  })

  return { containerRef, canvasRef, animator, stateRef, requestDraw, replay }
}

/**
 * Morphs a numeric matrix toward `target` with a springy ease whenever it
 * changes shape-compatibly; snaps when dimensions change.
 */
export function useMorph(
  target: number[][],
  animator: Animator,
  animate: boolean,
  requestDraw: () => void,
) {
  const shownRef = useRef<number[][] | null>(null)
  const firstRef = useRef(true)

  useEffect(() => {
    const prev = shownRef.current
    const compatible =
      prev &&
      prev.length === target.length &&
      prev.every((row, i) => row.length === target[i].length)

    if (firstRef.current || !animate || !compatible) {
      shownRef.current = target.map((r) => r.slice())
      firstRef.current = false
      requestDraw()
      return
    }

    const changed = prev!.some((row, i) => row.some((v, j) => v !== target[i][j]))
    if (!changed) return

    const from = prev!.map((r) => r.slice())
    animator.run('morph', 650, easeOutBack, (p) => {
      shownRef.current = from.map((row, i) => row.map((v, j) => v + (target[i][j] - v) * p))
      requestDraw()
    })
  }, [target, animate, animator, requestDraw])

  // Until the effect runs (first paint), fall back to the target itself.
  return () => shownRef.current ?? target
}

export function resolveSeries(series: SeriesDef[]): ResolvedSeries[] {
  return series.map((s, i) => {
    const colorHex = s.color ?? PALETTE[i % PALETTE.length]
    return {
      key: s.key,
      label: s.label ?? s.key,
      colorHex,
      color: hexToRgb(colorHex),
      fill: s.fill ?? 'dither',
    }
  })
}

export function fmtDefault(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (a >= 10_000) return `${Math.round(v / 1000)}k`
  if (a >= 1_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(Math.round(v * 100) / 100)
}

export const DIM_ALPHA = 70
