// Zooming a photo in and out: by click, double tap or the zoom button.
import {
  clampView,
  FIT_VIEW,
  type Point,
  panBounds,
  type View,
  viewRect,
  zoomAt,
  zoomTarget,
} from "../core/geometry.js";
import { DURATION, EASE, placeAt, play } from "./animate.js";
import { current, fitOf, place, type Session, wrapperSize } from "./session.js";
import type { SlideEl } from "./slides.js";

/** How far a slide zooms, or null when it can't: videos, small photos, unknown sizes, errors. */
export function zoomOf(s: Session, slide: SlideEl): number | null {
  const f = fitOf(s, slide);
  if (!f || slide.data.type !== "image" || slide.status === "error") return null;
  return zoomTarget(slide.data.native, f.width);
}

/** Zooms in around `point` (the photo's center without one), or back out to fit when zoomed. */
export async function toggleZoom(s: Session, sync: () => void, point?: Point): Promise<void> {
  const slide = current(s);
  const f = fitOf(s, slide);
  const zoom = zoomOf(s, slide);
  if (!f || zoom === null) return;
  const from = s.view;
  const center = point ?? { x: f.x + f.width / 2, y: f.y + f.height / 2 };
  const target: View =
    from.scale > 1.01 ? FIT_VIEW : clampView(zoomAt(from, f, center, zoom), panBounds(f, zoom, s.size));
  s.view = target;
  place(s);
  sync();
  const size = wrapperSize(slide, f);
  await play(
    slide.media,
    [{ transform: placeAt(viewRect(f, from), size) }, { transform: placeAt(viewRect(f, target), size) }],
    DURATION,
    EASE,
  );
  if (current(s) !== slide || s.view !== target) return;
  // Re-render at the new size: the browser draws sharp pixels, and srcset can pick a larger file.
  slide.base = target.scale;
  if (slide.large?.srcset) slide.large.sizes = `${Math.round(f.width * target.scale)}px`;
  place(s);
}
