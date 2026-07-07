/** 8x8 Bayer ordered-dithering matrix. */
const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

/** Threshold in (0,1) for cell (x,y). A cell is "on" when density > bayer(x,y). */
export function bayer(x: number, y: number): number {
  return (BAYER_8[y & 7][x & 7] + 0.5) / 64
}

/** Diagonal "/" hatch stripes on the pixel grid. */
export function hatch(x: number, y: number, period = 6, width = 3): boolean {
  return (((x + y) % period) + period) % period < width
}

/** Deterministic 2D hash → [0,1). Used for sparkles so renders are stable per seed. */
export function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
