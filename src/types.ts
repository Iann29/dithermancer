import type { CSSProperties } from 'react'
import type { RGB } from './core/color'

export type FillMode = 'dither' | 'hatch' | 'solid'

export interface SeriesDef {
  /** Field name in each datum holding this series' numeric value. */
  key: string
  /** Legend / tooltip label. Defaults to `key`. */
  label?: string
  /** Any CSS hex color, e.g. "#8b5cf6". Defaults to the built-in palette. */
  color?: string
  /** Texture used for the fill. Defaults to 'dither'; 'hatch' gives diagonal stripes. */
  fill?: FillMode
}

export type Datum = Record<string, number | string>

export interface PixelTheme {
  /** Axis tick / label color. */
  axis: string
  /** Muted text (legend, x labels). */
  text: string
  /** Font family for every label — keep it mono for the retro look. */
  font: string
  fontSize: number
  /** Tooltip colors. */
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  tooltipTitle: string
  /** Crosshair color on hover. */
  crosshair: string
}

export interface PixelChartHandle {
  /** Re-run the intro animation. */
  replay: () => void
}

export interface BaseChartProps {
  /** Chart height in CSS px. Width follows the container. */
  height?: number
  /** Size of one chunky pixel in CSS px. 3 is the classic look. */
  pixelSize?: number
  theme?: Partial<PixelTheme>
  /** Animate on mount and on data change. */
  animate?: boolean
  /** Random bright pixels twinkling inside the fills. */
  sparkle?: boolean
  showLegend?: boolean
  showTooltip?: boolean
  showAxes?: boolean
  /** Format numbers in tooltips / axis. */
  formatValue?: (v: number) => string
  className?: string
  style?: CSSProperties
}

export interface CartesianChartProps extends BaseChartProps {
  data: Datum[]
  series: SeriesDef[]
  /** Field in each datum used for x labels. Default "label". */
  xKey?: string
}

export interface ResolvedSeries {
  key: string
  label: string
  colorHex: string
  color: RGB
  fill: FillMode
}
