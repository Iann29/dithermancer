export type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return [128, 128, 128]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/** Push a color toward white. */
export const lighten = (c: RGB, t: number): RGB => mix(c, [255, 255, 255], t)

/** Push a color toward the near-black canvas floor (slightly blue so it stays moody). */
export const darken = (c: RGB, t: number): RGB => mix(c, [6, 8, 14], t)

export const rgbCss = (c: RGB, a = 1): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`
