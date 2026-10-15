// Slide elements. Each holds a wrapper for its media: the thumbnail's image as a placeholder and, once
// decoded, the large image on top. session.ts sizes and places the wrapper.
import type { SlideData } from "./links";

export interface SlideEl {
  data: SlideData;
  /** [data-dlb-slide], moved sideways in the strip. */
  el: HTMLElement;
  /** The wrapper that is sized and transformed. */
  media: HTMLElement;
  large: HTMLImageElement | null;
  /** Loading of the large image, started once. */
  ready: Promise<void> | null;
  status: "loading" | "ready" | "error";
  /** The zoom the wrapper was last sized for; its transform scales relative to it. */
  base: number;
}

/** Inline styles for media in the wrapper: fill it, whatever the page's CSS reset says. */
export const FILL =
  "position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;display:block";

export function createSlide(data: SlideData): SlideEl {
  const el = document.createElement("div");
  el.dataset.dlbSlide = "";
  el.style.cssText = "position:absolute;inset:0";
  const media = document.createElement("div");
  media.style.cssText = "position:absolute;left:0;top:0;transform-origin:0 0";
  if (data.thumb) {
    // The thumbnail is loaded already, so it shows at once. For a video it is the poster.
    const alt = data.type === "video" ? data.thumb.alt : "";
    media.append(image(data.thumb.currentSrc || data.thumb.src, alt));
  }
  el.append(media);
  return {
    data,
    el,
    media,
    large: null,
    ready: null,
    status: data.type === "video" ? "ready" : "loading",
    base: 1,
  };
}

export function image(src: string, alt: string, srcset?: string, sizes?: number): HTMLImageElement {
  const img = new Image();
  img.alt = alt;
  img.draggable = false;
  img.style.cssText = FILL;
  if (srcset) {
    img.sizes = `${Math.round(sizes ?? innerWidth)}px`;
    img.srcset = srcset;
  }
  img.src = src;
  return img;
}

/** Loads and decodes the large image once, then lays it over the placeholder. Never rejects. */
export function loadLarge(slide: SlideEl, sizes: number): Promise<void> {
  slide.ready ??= decode(slide, sizes);
  return slide.ready;
}

async function decode(slide: SlideEl, sizes: number): Promise<void> {
  const { data } = slide;
  if (data.type === "video") return;
  const alt = data.thumb?.alt ?? data.link.textContent?.trim() ?? "";
  const img = image(data.src, alt, data.srcset, sizes);
  try {
    await img.decode();
    data.aspect ??= { width: img.naturalWidth, height: img.naturalHeight };
    // With a srcset, naturalWidth depends on the chosen file; the native width came from the srcset then.
    if (!data.srcset) data.native ??= img.naturalWidth;
    slide.large = img;
    slide.media.append(img);
    slide.status = "ready";
  } catch {
    slide.status = "error";
  }
}
