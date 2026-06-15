/**
 * Animation tween primitives. We don't pull in a library; the tween needs we
 * have are small (move, slide, climb, dice roll, camera transition).
 *
 * Each tween returns a function that, when called with the elapsed ms,
 * returns true while the tween is still running and false once finished.
 * Caller is responsible for calling it every frame.
 */
import { clamp, easeInOutCubic, easeOutCubic, easeInCubic } from './math';

export interface Tween {
  /** Advance the tween; returns true while running, false when done. */
  step(dtMs: number): boolean;
  /** Current eased progress 0..1 (only meaningful for value tweens). */
  readonly t: number;
  readonly durationMs: number;
  readonly done: boolean;
}

interface BaseOptions {
  durationMs: number;
  ease?: (t: number) => number;
}

export function makeTween(opts: BaseOptions, onTick: (t: number) => void): Tween {
  const ease = opts.ease ?? easeInOutCubic;
  let elapsed = 0;
  return {
    get durationMs() { return opts.durationMs; },
    get t() { return ease(clamp(elapsed / opts.durationMs, 0, 1)); },
    get done() { return elapsed >= opts.durationMs; },
    step(dtMs: number): boolean {
      elapsed += dtMs;
      const t = ease(clamp(elapsed / opts.durationMs, 0, 1));
      onTick(t);
      return elapsed < opts.durationMs;
    }
  };
}

/** Convenience: tween a numeric value with onUpdate. */
export function tweenValue(opts: BaseOptions, from: number, to: number, onUpdate: (v: number) => void): Tween {
  return makeTween(opts, (t) => onUpdate(from + (to - from) * t));
}

/** Run a sequence of tweens. Yields a "step" that returns true until all done. */
export class TweenChain {
  private current: Tween | null = null;
  private queue: Tween[] = [];
  private _done = false;
  constructor(tweens: Tween[]) { this.queue = tweens; this.advance(); }
  private advance(): void {
    this.current = this.queue.shift() ?? null;
    if (!this.current) this._done = true;
  }
  step(dtMs: number): boolean {
    if (this._done || !this.current) return false;
    const stillRunning = this.current.step(dtMs);
    if (!stillRunning) this.advance();
    return !this._done;
  }
  get done(): boolean { return this._done; }
}

export const Easings = { easeInOutCubic, easeOutCubic, easeInCubic };
