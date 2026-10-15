// Geometry in CSS pixels, relative to the viewport element's top-left corner.

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point, Size {}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Where the current media are: offset from their fit position, and scale relative to the fit size. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

/** The view offsets that keep a zoomed photo covering the viewport. */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const FIT_VIEW: View = { scale: 1, x: 0, y: 0 };
export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** The largest rectangle with the media's aspect ratio inside `area`, centered in it. */
export function fit(media: Size, area: Rect): Rect {
  const scale = Math.min(area.width / media.width, area.height / media.height);
  const width = media.width * scale;
  const height = media.height * scale;
  return { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
}

/** The media's rectangle on screen for a view. */
export function viewRect(fitRect: Rect, view: View): Rect {
  return {
    x: fitRect.x + view.x,
    y: fitRect.y + view.y,
    width: fitRect.width * view.scale,
    height: fitRect.height * view.scale,
  };
}

/**
 * The thumbnail's frame for the opening and closing zoom. With `object-fit: cover` the whole photo is
 * larger than the thumbnail's box and centered on it; the insets clip it back to the box.
 */
export function thumbStart(box: Rect, media: Size, cover: boolean): { rect: Rect; clip: Insets } {
  if (!cover) return { rect: box, clip: NO_INSETS };
  const scale = Math.max(box.width / media.width, box.height / media.height);
  const width = media.width * scale;
  const height = media.height * scale;
  const left = (width - box.width) / 2;
  const top = (height - box.height) / 2;
  return {
    rect: { x: box.x - left, y: box.y - top, width, height },
    clip: { top, right: left, bottom: top, left },
  };
}

/** How far a photo zooms: up to 3 times its fit size, never past its native width; null below 1.2. */
export function zoomTarget(nativeWidth: number | undefined, fitWidth: number): number | null {
  if (!nativeWidth) return null;
  const zoom = Math.min(nativeWidth / fitWidth, 3);
  return zoom >= 1.2 ? zoom : null;
}

/** The view at `scale` that keeps the media point under `point` where it is. */
export function zoomAt(view: View, fitRect: Rect, point: Point, scale: number): View {
  const localX = (point.x - fitRect.x - view.x) / view.scale;
  const localY = (point.y - fitRect.y - view.y) / view.scale;
  return { scale, x: point.x - fitRect.x - localX * scale, y: point.y - fitRect.y - localY * scale };
}

/** Offsets that keep media at `scale` covering the viewport, or centered on an axis where they are smaller. */
export function panBounds(fitRect: Rect, scale: number, viewport: Size): Bounds {
  const [minX, maxX] = axis(fitRect.width * scale, viewport.width, fitRect.x);
  const [minY, maxY] = axis(fitRect.height * scale, viewport.height, fitRect.y);
  return { minX, maxX, minY, maxY };
}

function axis(size: number, space: number, start: number): [number, number] {
  if (size <= space) {
    const center = (space - size) / 2 - start;
    return [center, center];
  }
  // 0 - start, not -start: with start = 0 that would be -0, which equality checks treat as different.
  return [space - size - start, 0 - start];
}

export function clampView(view: View, bounds: Bounds): View {
  return {
    scale: view.scale,
    x: clamp(view.x, bounds.minX, bounds.maxX),
    y: clamp(view.y, bounds.minY, bounds.maxY),
  };
}
