// Reading a slide's size and id from its link's attributes, without the DOM.
import type { Size } from "./geometry";

/** The largest width descriptor in a srcset: "a.webp 1080w, b.webp 1600w" gives 1600. */
export function largestWidth(srcset: string | undefined): number | undefined {
  let max = 0;
  for (const candidate of srcset?.split(",") ?? []) {
    const match = /\s(\d+)w$/.exec(candidate.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max || undefined;
}

export interface SizeInfo {
  /** Aspect ratio as a size; null until the large image has loaded. */
  aspect: Size | null;
  /** Native width in CSS pixels, for zooming. */
  native: number | undefined;
}

/** Width and height attributes first, then the thumbnail's aspect ratio with the srcset's largest width. */
export function resolveSize(
  width: number,
  height: number,
  thumb: Size | null,
  srcset: string | undefined,
): SizeInfo {
  if (width > 0 && height > 0) return { aspect: { width, height }, native: width };
  const aspect = thumb && thumb.width > 0 && thumb.height > 0 ? thumb : null;
  return { aspect, native: largestWidth(srcset) };
}

export const slideId = (explicit: string | undefined, galleryId: string, index: number): string =>
  explicit || `${galleryId}-${index + 1}`;
