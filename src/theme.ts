import type { PixelTheme } from './types'

export const MONO_FONT =
  'ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace'

export const darkTheme: PixelTheme = {
  axis: '#6b7078',
  text: '#9aa0a8',
  font: MONO_FONT,
  fontSize: 11,
  tooltipBg: '#16171b',
  tooltipBorder: '#2c2e34',
  tooltipText: '#e6e8ec',
  tooltipTitle: '#8a8f98',
  crosshair: '#c8cdd6',
}

/** Default series palette, sampled from the reference aesthetic. */
export const PALETTE = [
  '#4f8ff7', // blue
  '#8b5cf6', // purple
  '#2fd66c', // green
  '#f08c2e', // orange
  '#ee4d97', // pink
  '#8a8f98', // gray
]
