// Reading a slide's size and id from its link's attributes, without the DOM.
import type { Size } from "./geometry.js";

export interface SizeInfo {
  /** Aspect ratio as a size; null until the large image has loaded. */
  aspect: Size | null;
  /** Native width in CSS pixels, for zooming. */
  native: number | undefined;
}

/** Width and height attributes first, then the thumbnail's aspect ratio; the native width once the image loads. */
export function resolveSize(width: number, height: number, thumb: Size | null): SizeInfo {
  if (width > 0 && height > 0) return { aspect: { width, height }, native: width };
  const aspect = thumb && thumb.width > 0 && thumb.height > 0 ? thumb : null;
  return { aspect, native: undefined };
}

export const slideId = (explicit: string | undefined, galleryId: string, index: number): string =>
  explicit || `${galleryId}-${index + 1}`;
