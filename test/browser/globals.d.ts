import type { Lightbox, LightboxOptions } from "../../src/index";

declare global {
  interface Window {
    /** "open:<id>", "change:<id>" and "close:<id>" for every event, in order. */
    log: string[];
    /** The lightboxes of the galleries #one, #two, #three and #four. */
    boxes: Lightbox[];
    lightbox: (options: LightboxOptions) => Lightbox;
  }
}
