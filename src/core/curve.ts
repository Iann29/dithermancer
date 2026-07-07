/**
 * Monotone cubic interpolation (Fritsch–Carlson).
 * Returns a sampler f(x) that passes smoothly through all points
 * without overshooting between them — the classic "smooth chart curve".
 */
export function monotoneCubic(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  if (n === 0) return () => 0
  if (n === 1) return () => ys[0]

  const dx: number[] = new Array(n - 1)
  const slope: number[] = new Array(n - 1)
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i]
    slope[i] = (ys[i + 1] - ys[i]) / (dx[i] || 1e-9)
  }

  const m: number[] = new Array(n)
  m[0] = slope[0]
  m[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) m[i] = 0
    else {
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i])
    }
  }

  return (x: number) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let lo = 0
    let hi = n - 2
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (xs[mid] <= x) lo = mid
      else hi = mid - 1
    }
    const i = lo
    const h = dx[i] || 1e-9
    const t = (x - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      ys[i] * (2 * t3 - 3 * t2 + 1) +
      m[i] * h * (t3 - 2 * t2 + t) +
      ys[i + 1] * (-2 * t3 + 3 * t2) +
      m[i + 1] * h * (t3 - t2)
    )
  }
}

/** Straight-segment sampler, same signature as monotoneCubic. */
export function linearSampler(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  if (n === 0) return () => 0
  if (n === 1) return () => ys[0]
  return (x: number) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (i < n - 2 && xs[i + 1] < x) i++
    const t = (x - xs[i]) / (xs[i + 1] - xs[i] || 1e-9)
    return ys[i] + (ys[i + 1] - ys[i]) * t
  }
}
