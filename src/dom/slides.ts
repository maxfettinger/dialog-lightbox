// Slide elements. Each holds a wrapper for its media: the thumbnail's image as a placeholder and, once
// decoded, the large image on top. session.ts sizes and places the wrapper.
import type { SlideData } from "./links.js";

export interface SlideEl {
  data: SlideData;
  /** [data-dlb-slide], moved sideways in the strip. */
  el: HTMLElement;
  /** The wrapper that is sized and transformed. */
  media: HTMLElement;
  /** Loading of the large image, started once. */
  ready: Promise<void> | null;
  status: "loading" | "ready" | "error";
  /** The zoom the wrapper was last sized for; its transform scales relative to it. */
  base: number;
}

/** Inline styles for media in the wrapper: fill it, whatever the page's CSS reset says. */
export const FILL =
  "position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;display:block";

/** `overlay`: the page's template for this slide type, copied over the media. */
export function createSlide(data: SlideData, overlay?: HTMLTemplateElement): SlideEl {
  const el = document.createElement("div");
  el.dataset.dlbSlide = "";
  el.style.cssText = "position:absolute;inset:0";
  const media = document.createElement("div");
  // max-width:none: a zoomed wrapper is wider than the slide, whatever a page's CSS reset caps.
  media.style.cssText = "position:absolute;left:0;top:0;transform-origin:0 0;max-width:none;max-height:none";
  if (data.thumb) {
    // The thumbnail is loaded already, so it shows at once. For a video it is the poster.
    const alt = data.type === "video" ? data.thumb.alt : "";
    media.append(image(data.thumb.currentSrc || data.thumb.src, alt));
  }
  if (overlay) {
    const copy = document.createElement("div");
    copy.dataset.dlbOverlay = "";
    copy.style.cssText = "position:absolute;inset:0;z-index:1";
    copy.append(overlay.content.cloneNode(true));
    media.append(copy);
  }
  el.append(media);
  return {
    data,
    el,
    media,
    ready: null,
    status: data.type === "video" ? "ready" : "loading",
    base: 1,
  };
}

export function image(src: string, alt: string): HTMLImageElement {
  const img = new Image();
  img.alt = alt;
  img.draggable = false;
  img.style.cssText = FILL;
  img.src = src;
  return img;
}

/** Loads and decodes the large image once, then lays it over the placeholder. Never rejects. */
export function loadLarge(slide: SlideEl): Promise<void> {
  slide.ready ??= decode(slide);
  return slide.ready;
}

async function decode(slide: SlideEl): Promise<void> {
  const { data } = slide;
  if (data.type === "video") return;
  const alt = data.thumb?.alt ?? data.link.textContent?.trim() ?? "";
  const img = image(data.src, alt);
  try {
    await img.decode();
    data.aspect ??= { width: img.naturalWidth, height: img.naturalHeight };
    data.native ??= img.naturalWidth;
    slide.media.append(img);
    slide.status = "ready";
  } catch {
    slide.status = "error";
  }
}

const preloaded = new WeakSet<HTMLAnchorElement>();

/** Starts loading a link's large image before it opens (on mouse hover). */
export function preload(data: SlideData): void {
  if (data.type === "video" || preloaded.has(data.link)) return;
  preloaded.add(data.link);
  image(data.src, "");
}
