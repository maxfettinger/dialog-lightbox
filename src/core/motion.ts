// Motion: release momentum, resistance past an edge, springs sampled into keyframes, and the decisions a
// release makes (change the slide, close the box).
import { clamp, type Size, type View } from "./geometry";

const DECELERATION = 0.995;
const STEPS = 30;

/** How far momentum carries a release at `velocity` px/ms: about 199 times the velocity. */
export const project = (velocity: number): number => (velocity * DECELERATION) / (1 - DECELERATION);

/** Resistance past an edge, as on iOS: `overshoot` px of finger movement move less, never `dimension`. */
export function resist(overshoot: number, dimension: number): number {
  const distance = Math.abs(overshoot);
  return Math.sign(overshoot) * (1 - 1 / ((distance * 0.55) / dimension + 1)) * dimension;
}

/** `value`, with resistance where it leaves [min, max]. */
export function rubber(value: number, min: number, max: number, dimension: number): number {
  if (value < min) return min + resist(value - min, dimension);
  if (value > max) return max + resist(value - max, dimension);
  return value;
}

export interface SpringFrames {
  /** STEPS + 1 frames, evenly spaced in time, with one value per animated number. */
  frames: number[][];
  /** Milliseconds. */
  duration: number;
}

/**
 * Critically damped springs from `from` to `to`, one per number, each starting at its `velocity` (px/ms).
 * The frames are meant for a Web Animation with linear easing between them. `omega` is in rad/s.
 */
export function spring(from: number[], to: number[], velocity: number[], omega: number): SpringFrames {
  const curves = from.map((start, i) => curve(start - (to[i] ?? 0), velocity[i] ?? 0, omega / 1000));
  const duration = Math.max(0, ...curves.map((c) => c.duration));
  const frames = Array.from({ length: STEPS + 1 }, (_, n) =>
    to.map((target, i) => (n === STEPS ? target : target + (curves[i]?.offset((n / STEPS) * duration) ?? 0))),
  );
  return { frames, duration };
}

/** Offset from the target over time (ms) for start offset `d` and velocity `v`; `w` is omega per ms. */
function curve(d: number, v: number, w: number): { offset: (t: number) => number; duration: number } {
  const b = v + w * d;
  const offset = (t: number): number => (d + b * t) * Math.exp(-w * t);
  const speed = (t: number): number => (b - w * (d + b * t)) * Math.exp(-w * t);
  let duration = 0;
  while (duration < 2000 && (Math.abs(offset(duration)) > 0.5 || Math.abs(speed(duration)) > 0.05))
    duration += 8;
  return { offset, duration };
}

/** A swipe's result: 1 for the next slide, -1 for the previous one, 0 to stay. Negative dx and vx point left. */
export function swipeDirection(dx: number, vx: number, width: number): -1 | 0 | 1 {
  if (Math.abs(vx) > 0.5) return vx < 0 ? 1 : -1;
  if (Math.abs(dx) > width / 2) return dx < 0 ? 1 : -1;
  return 0;
}

/** Progress of a drag down: 0 at rest, 1 after a third of the viewport height. */
export const dismissProgress = (dy: number, height: number): number => clamp(dy / (height / 3), 0, 1);

/** Whether a drag down released at `dy` with velocity `vy` closes the box. */
export const shouldDismiss = (dy: number, vy: number, height: number): boolean =>
  dy + project(vy) > 0.13 * height;

/** The view while dragging down: the media follow the finger and shrink around their center. */
export function dismissView(fitSize: Size, dx: number, dy: number, progress: number): View {
  const scale = 1 - 0.2 * progress;
  return { scale, x: dx + (fitSize.width * (1 - scale)) / 2, y: dy + (fitSize.height * (1 - scale)) / 2 };
}
