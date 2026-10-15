// The opening and closing zoom between a thumbnail and the box, or a fade when no thumbnail is on screen.
import { type Insets, NO_INSETS, type Rect, thumbStart, viewRect } from "../core/geometry.js";
import { clipAt, DURATION, EASE, placeAt, play } from "./animate.js";
import { current, fitOf, place, type Session, wrapperSize } from "./session.js";
import type { SlideEl } from "./slides.js";

export async function openAnimation(s: Session, dialog: HTMLElement): Promise<void> {
  const slide = current(s);
  const f = fitOf(s, slide);
  const thumb = onScreen(slide);
  place(s);
  if (!f || !thumb) {
    await Promise.all([
      play(slide.media, [{ opacity: 0 }, { opacity: 1 }], DURATION, EASE),
      backdrop(dialog, 1, 0),
    ]);
    return;
  }
  const size = wrapperSize(slide, f);
  const start = frameOf(s, slide, thumb);
  thumb.style.visibility = "hidden";
  await Promise.all([
    play(
      slide.media,
      [
        { transform: placeAt(start.rect, size), clipPath: clipAt(start.clip, start.rect, size) },
        { transform: placeAt(f, size), clipPath: clipAt(NO_INSETS, f, size) },
      ],
      DURATION,
      EASE,
    ),
    backdrop(dialog, 1, 0),
  ]);
  thumb.style.visibility = "";
}

/** Scrolls the current slide's thumbnail into view, then zooms back onto it from wherever the media are. */
export async function closeAnimation(s: Session, dialog: HTMLElement): Promise<void> {
  const slide = current(s);
  slide.data.link.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  const f = fitOf(s, slide);
  const thumb = onScreen(slide);
  if (!f || !thumb) {
    slide.media.style.opacity = "0";
    await Promise.all([
      play(slide.media, [{ opacity: 1 }, { opacity: 0 }], DURATION, EASE),
      backdrop(dialog, 0),
    ]);
    return;
  }
  const size = wrapperSize(slide, f);
  const now = viewRect(f, s.view);
  const end = frameOf(s, slide, thumb);
  slide.media.style.transform = placeAt(end.rect, size);
  slide.media.style.clipPath = clipAt(end.clip, end.rect, size);
  thumb.style.visibility = "hidden";
  await Promise.all([
    play(
      slide.media,
      [
        { transform: placeAt(now, size), clipPath: clipAt(NO_INSETS, now, size) },
        { transform: placeAt(end.rect, size), clipPath: clipAt(end.clip, end.rect, size) },
      ],
      DURATION,
      EASE,
    ),
    backdrop(dialog, 0),
  ]);
  thumb.style.visibility = "";
}

/** Animates --dlb-opacity on the dialog to `to`, from `from` or from its current value. */
export function backdrop(dialog: HTMLElement, to: number, from?: number): Promise<void> {
  const start = from ?? (Number.parseFloat(getComputedStyle(dialog).getPropertyValue("--dlb-opacity")) || 0);
  dialog.style.setProperty("--dlb-opacity", String(to));
  return play(dialog, [{ "--dlb-opacity": String(start) }, { "--dlb-opacity": String(to) }], DURATION, EASE);
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
