import { bayer, hatch } from '../core/dither'
import { mix, darken, lighten, type RGB } from '../core/color'
import type { FillMode } from '../types'
import type { Surface } from '../core/pixels'

/**
 * Paint one cell of a textured fill.
 * `t` is normalized depth: 0 at the bright edge of the shape, 1 at its faded end.
 */
export function fillCell(
  s: Surface,
  x: number,
  y: number,
  t: number,
  fill: FillMode,
  color: RGB,
  alpha: number,
) {
  const th = bayer(x, y)
  let on = false
  if (fill === 'solid') {
    on = true
  } else if (fill === 'hatch') {
    if (hatch(x, y)) {
      on = 0.72 * Math.pow(1 - t, 0.6) + 0.3 > th
    } else {
      // sparse dots between the stripes
      on = 0.12 * (1 - t) > th
    }
  } else {
    on = 0.94 * Math.pow(1 - t, 1.8) + 0.05 > th
  }
  if (!on) return
  const shade = Math.min(1, t * 0.85)
  s.px(x, y, mix(color, darken(color, 0.78), shade), alpha)
}

/** The bright solid edge color for a series. */
export function edgeColor(color: RGB): RGB {
  return lighten(color, 0.34)
}

/** Sparkle color — near-white flash of the series color. */
export function sparkColor(color: RGB): RGB {
  return lighten(color, 0.65)
}
