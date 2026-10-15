// Slide data from a gallery's links: what to load, how big it is, its id.
import type { Size } from "../core/geometry";
import { resolveSize, slideId } from "../core/slide";

export interface SlideData {
  index: number;
  id: string;
  type: "image" | "video";
  link: HTMLAnchorElement;
  thumb: HTMLImageElement | null;
  src: string;
  srcset: string | undefined;
  /** Aspect ratio as a size; null until the large image has loaded when nothing else tells it. */
  aspect: Size | null;
  /** Native width in CSS pixels, for zooming. */
  native: number | undefined;
  audio: boolean;
}

export function readSlide(link: HTMLAnchorElement, index: number, galleryId: string): SlideData {
  const { dataset } = link;
  const thumb = link.querySelector("img");
  const natural = thumb?.naturalWidth ? { width: thumb.naturalWidth, height: thumb.naturalHeight } : null;
  return {
    index,
    id: slideId(dataset.dlbId, galleryId, index),
    type: dataset.dlbType === "video" ? "video" : "image",
    link,
    thumb,
    src: link.href,
    srcset: dataset.dlbSrcset,
    ...resolveSize(Number(dataset.dlbWidth), Number(dataset.dlbHeight), natural, dataset.dlbSrcset),
    audio: dataset.dlbAudio !== "false",
  };
}

export const readSlides = (gallery: HTMLElement, galleryId: string): SlideData[] =>
  [...gallery.querySelectorAll<HTMLAnchorElement>("a[href]")].map((link, index) =>
    readSlide(link, index, galleryId),
  );
