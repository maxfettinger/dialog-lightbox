// The opening and closing zoom between a thumbnail and the box, or a fade when no thumbnail is on screen.
// The zoom runs on a spring. The photo's rectangle and the visible frame (the photo clipped to the
// thumbnail's crop) both move in a straight line, so a cropped thumbnail opens up evenly on every side.
import { type Insets, mix, NO_INSETS, type Rect, thumbStart, viewRect } from "../core/geometry.js";
import { clipAt, glide, placeAt } from "./animate.js";
import { current, fitOf, place, type Session, wrapperSize } from "./session.js";
import type { SlideEl } from "./slides.js";

/**
 * Opens (`open`) or closes the box: a zoom between the thumbnail and the media, or a fade when no thumbnail is
 * on screen. Closing first scrolls the thumbnail into view and zooms from wherever the media are.
 */
export async function zoomBox(s: Session, dialog: HTMLElement, open: boolean): Promise<void> {
  const slide = current(s);
  const { media } = slide;
  if (open) place(s);
  else slide.data.link.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  const f = fitOf(s, slide);
  const thumb = onScreen(slide);
  const omega = open ? 20 : 26;
  const fade = backdrop(dialog, open ? 1 : 0, open ? 0 : undefined);
  if (!f || !thumb) {
    media.style.opacity = open ? "" : "0";
    await Promise.all([glide(media, (p) => ({ opacity: open ? p : 1 - p }), omega), fade]);
    return;
  }
  const size = wrapperSize(slide, f);
  const box = frameOf(s, slide, thumb);
  const now = { rect: viewRect(f, s.view), clip: NO_INSETS };
  const [a, b] = open ? [box, now] : [now, box];
  media.style.transform = placeAt(b.rect, size);
  media.style.clipPath = clipAt(b.clip, b.rect, size);
  await Promise.all([
    glide(
      media,
      (p) => {
        const rect = mix(a.rect, b.rect, p);
        return { transform: placeAt(rect, size), clipPath: clipAt(mix(a.clip, b.clip, p), rect, size) };
      },
      omega,
    ),
    fade,
  ]);
}

/** Animates --dlb-opacity on the dialog to `to`, from `from` or from its current value. */
export function backdrop(dialog: HTMLElement, to: number, from?: number): Promise<void> {
  const start = from ?? (Number.parseFloat(getComputedStyle(dialog).getPropertyValue("--dlb-opacity")) || 0);
  dialog.style.setProperty("--dlb-opacity", String(to));
  return glide(dialog, (p) => ({ "--dlb-opacity": String(start + (to - start) * p) }), to ? 20 : 26);
}

/** The slide's thumbnail if it has a size and lies inside the window, else null. */
function onScreen(slide: SlideEl): HTMLImageElement | null {
  const thumb = slide.data.thumb;
  if (!thumb) return null;
  const r = thumb.getBoundingClientRect();
  const visible =
    r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  return visible ? thumb : null;
}

/** The thumbnail's frame in viewport coordinates, with the crop of object-fit: cover. */
function frameOf(s: Session, slide: SlideEl, thumb: HTMLImageElement): { rect: Rect; clip: Insets } {
  const r = thumb.getBoundingClientRect();
  const box = { x: r.left - s.origin.x, y: r.top - s.origin.y, width: r.width, height: r.height };
  return thumbStart(box, slide.data.aspect!, getComputedStyle(thumb).objectFit === "cover");
}
