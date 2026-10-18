// Helpers around the Web Animations API. The pattern everywhere: set the final state inline first, then
// animate from the old state to it, so a cancelled or skipped animation still leaves the right state.
import type { Insets, Rect, Size } from "../core/geometry.js";
import { spring } from "../core/motion.js";

const reducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Runs an animation and resolves when it ends or is cancelled. With reduced motion it does nothing. */
export async function play(element: Element, keyframes: Keyframe[], duration: number): Promise<void> {
  if (duration <= 0 || reducedMotion()) return;
  // The lightbox listens for these to know when everything has settled.
  element.dispatchEvent(new Event("dlbmove", { bubbles: true }));
  try {
    await element.animate(keyframes, duration).finished;
  } catch {
    // Cancelled: whoever cancelled it has set the state.
  }
  element.dispatchEvent(new Event("dlbsettle", { bubbles: true }));
}

/**
 * Animates `element` on a spring from progress 0 to 1, with `frame(p)` the keyframe at progress p. `omega` as in
 * spring(): 20 opens and zooms in, 26 closes and zooms out, close to the springs of Lightbox3.
 */
export function glide(element: Element, frame: (p: number) => Keyframe, omega: number): Promise<void> {
  // Over 1000 steps, so the spring stops within half a step of the end.
  const { frames, duration } = spring([0], [1000], [0], omega);
  return play(
    element,
    frames.map(([x = 0]) => frame(x / 1000)),
    duration,
  );
}

/** Cancels the element's animations and returns its transform as it was on screen. */
export function stop(element: Element): DOMMatrix {
  const matrix = new DOMMatrix(getComputedStyle(element).transform);
  for (const animation of element.getAnimations()) animation.cancel();
  return matrix;
}

/** The transform that puts an element of `size` (transform origin top left) onto `rect`. */
export const placeAt = (rect: Rect, size: Size): string =>
  `translate(${rect.x}px, ${rect.y}px) scale(${rect.width / size.width})`;

/** A clip-path for `insets` given in screen pixels on `rect`, in the element's own pixels. */
export function clipAt(insets: Insets, rect: Rect, size: Size): string {
  const k = size.width / rect.width;
  return `inset(${insets.top * k}px ${insets.right * k}px ${insets.bottom * k}px ${insets.left * k}px)`;
}
