// Helpers around the Web Animations API. The pattern everywhere: set the final state inline first, then
// animate from the old state to it, so a cancelled or skipped animation still leaves the right state.
import type { Insets, Rect, Size } from "../core/geometry.js";

export const DURATION = 300;
export const EASE = "cubic-bezier(.4, 0, .22, 1)";

const reducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Runs an animation and resolves when it ends or is cancelled. With reduced motion it does nothing. */
export async function play(
  element: Element,
  keyframes: Keyframe[],
  duration: number,
  easing = "linear",
): Promise<void> {
  if (duration <= 0 || reducedMotion()) return;
  // The lightbox listens for these to know when everything has settled.
  element.dispatchEvent(new Event("dlbmove", { bubbles: true }));
  try {
    await element.animate(keyframes, { duration, easing }).finished;
  } catch {
    // Cancelled: whoever cancelled it has set the state.
  }
  element.dispatchEvent(new Event("dlbsettle", { bubbles: true }));
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
