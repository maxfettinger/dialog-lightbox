// Zooming a photo in and out: by click, double tap or the zoom button.
import {
  clampView,
  FIT_VIEW,
  type Point,
  panBounds,
  type Rect,
  type View,
  viewRect,
  zoomAt,
  zoomTarget,
} from "../core/geometry.js";
import { spring } from "../core/motion.js";
import { placeAt, play } from "./animate.js";
import { current, fitOf, place, type Session, wrapperSize } from "./session.js";
import type { SlideEl } from "./slides.js";

/** How far a slide zooms, or null when it can't: videos, small photos, unknown sizes, errors. */
export function zoomOf(s: Session, slide: SlideEl): number | null {
  const f = fitOf(s, slide);
  if (!f || slide.data.type !== "image" || slide.status === "error") return null;
  return zoomTarget(slide.data.native, f.width);
}

/** Springs the current media from the view on screen to `target`, starting at (vx, vy) px/ms. */
export function springView(
  s: Session,
  slide: SlideEl,
  f: Rect,
  target: View,
  vx: number,
  vy: number,
  omega: number,
): Promise<void> {
  const { frames, duration } = spring(
    [s.view.scale, s.view.x, s.view.y],
    [target.scale, target.x, target.y],
    [0, vx, vy],
    omega,
  );
  const size = wrapperSize(slide, f);
  s.view = target;
  place(s);
  const keyframes = frames.map(([scale = 1, x = 0, y = 0]) => ({
    transform: placeAt(viewRect(f, { scale, x, y }), size),
  }));
  return play(slide.media, keyframes, duration);
}

/** Zooms in around `point` (the photo's center without one), or back out to fit when zoomed. */
export async function toggleZoom(s: Session, sync: () => void, point?: Point): Promise<void> {
  const slide = current(s);
  const f = fitOf(s, slide);
  const zoom = zoomOf(s, slide);
  if (!f || zoom === null) return;
  const center = point ?? { x: f.x + f.width / 2, y: f.y + f.height / 2 };
  const target: View =
    s.view.scale > 1.01 ? FIT_VIEW : clampView(zoomAt(s.view, f, center, zoom), panBounds(f, zoom, s.size));
  // A zoom in springs like the opening, a zoom out like the closing.
  const done = springView(s, slide, f, target, 0, 0, target === FIT_VIEW ? 26 : 20);
  sync();
  await done;
  if (current(s) !== slide || s.view !== target) return;
  // Re-render at the new size, so the browser draws sharp pixels.
  slide.base = target.scale;
  place(s);
}
