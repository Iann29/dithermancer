/** "Nice" axis ticks covering [min, max] with roughly `count` steps. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) max = min + 1
  const span = max - min
  const rawStep = span / Math.max(1, count)
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const step = mag * (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1)
  const lo = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.abs(v) < step * 1e-6 ? 0 : Math.round(v * 1e6) / 1e6)
  }
  return ticks
}

/** Upper bound for a chart scale: a hair above the data max so peaks don't kiss the top. */
export function scaleMax(dataMax: number): number {
  if (dataMax <= 0) return 1
  return dataMax * 1.06
}
