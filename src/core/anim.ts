export type Ease = (t: number) => number

export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3)
export const easeInOutCubic: Ease = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
export const easeOutQuart: Ease = (t) => 1 - Math.pow(1 - t, 4)
/** Slight overshoot — the springy "shape ease" for data morphs. */
export const easeOutBack: Ease = (t) => {
  const c1 = 1.2
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface Task {
  t0: number
  dur: number
  ease: Ease
  onFrame: (p: number) => void
  onDone?: () => void
}

interface IntervalTask {
  last: number
  ms: number
  cb: () => void
}

/**
 * Tiny keyed rAF scheduler. One instance per chart; tasks are keyed so
 * re-running "reveal" or "morph" replaces the previous run of the same kind.
 */
export class Animator {
  private tasks = new Map<string, Task>()
  private intervals = new Map<string, IntervalTask>()
  private raf = 0

  run(key: string, dur: number, ease: Ease, onFrame: (p: number) => void, onDone?: () => void) {
    if (dur <= 0 || prefersReducedMotion()) {
      onFrame(1)
      onDone?.()
      return
    }
    this.tasks.set(key, { t0: performance.now(), dur, ease, onFrame, onDone })
    this.ensure()
  }

  /** Repeats cb roughly every `ms` while active (used for the sparkle twinkle). */
  interval(key: string, ms: number, cb: () => void) {
    if (prefersReducedMotion()) return
    this.intervals.set(key, { last: performance.now(), ms, cb })
    this.ensure()
  }

  stop(key: string) {
    this.tasks.delete(key)
    this.intervals.delete(key)
  }

  /** Stop everything. Safe to keep using afterwards (StrictMode remounts). */
  dispose() {
    this.tasks.clear()
    this.intervals.clear()
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private ensure() {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    this.raf = 0
    for (const [key, task] of this.tasks) {
      const p = Math.min(1, (now - task.t0) / task.dur)
      task.onFrame(task.ease(p))
      if (p >= 1) {
        this.tasks.delete(key)
        task.onDone?.()
      }
    }
    for (const iv of this.intervals.values()) {
      if (now - iv.last >= iv.ms) {
        iv.last = now
        iv.cb()
      }
    }
    if (this.tasks.size || this.intervals.size) this.ensure()
  }
}
