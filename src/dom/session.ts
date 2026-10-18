// One open lightbox: its slides, the three slide elements in the strip, and where everything is.
// place() writes every position from this state; the other dom/ modules change the state and call it.
import { FIT_VIEW, fit, type Rect, type Size, type View, viewRect } from "../core/geometry.js";
import { type GestureState, initialGesture } from "../core/gesture.js";
import { neighbours } from "../core/navigation.js";
import { placeAt } from "./animate.js";
import type { SlideData } from "./links.js";
import { createSlide, type SlideEl } from "./slides.js";

/** Space between slides, as a share of the viewport width. */
export const GAP = 0.1;

export interface Session {
  slides: SlideData[];
  loop: boolean;
  index: number;
  /** Previous, current and next slide element. */
  slots: [SlideEl | null, SlideEl, SlideEl | null];
  /** Holds the slide elements and moves sideways. */
  strip: HTMLElement;
  /** The strip's offset: 0 when the current slide is in place. */
  stripX: number;
  /** The current slide's media relative to their fit rectangle. */
  view: View;
  /** Strip and view when the current drag began. */
  from: { stripX: number; view: View };
  gesture: GestureState;
  timer: ReturnType<typeof setTimeout> | undefined;
  frame: number;
  /** The viewport's corner on screen, its size, and its content box, where photos fit. */
  origin: { x: number; y: number };
  size: Size;
  area: Rect;
  uiHidden: boolean;
  /** The opening animation runs; pointer input and navigation wait. */
  busy: boolean;
  closing: boolean;
  /** Aborting it removes every listener of this session. */
  abort: AbortController;
  /** The page's overlay templates per slide type. */
  overlays: Overlays;
}

export type Overlays = Partial<Record<SlideData["type"], HTMLTemplateElement>>;

export function createSession(
  slides: SlideData[],
  index: number,
  loop: boolean,
  viewport: HTMLElement,
  overlays: Overlays,
): Session {
  const strip = document.createElement("div");
  strip.style.cssText = "position:absolute;inset:0";
  viewport.append(strip);
  const session: Session = {
    slides,
    loop,
    index,
    slots: [null, createSlide(slides[index]!, overlays[slides[index]!.type]), null],
    strip,
    stripX: 0,
    view: FIT_VIEW,
    from: { stripX: 0, view: FIT_VIEW },
    gesture: initialGesture,
    timer: undefined,
    frame: 0,
    origin: { x: 0, y: 0 },
    size: { width: 0, height: 0 },
    area: { x: 0, y: 0, width: 0, height: 0 },
    uiHidden: false,
    busy: false,
    closing: false,
    abort: new AbortController(),
    overlays,
  };
  setSlots(session, index);
  measure(session, viewport);
  return session;
}

export const current = (s: Session): SlideEl => s.slots[1];

/** The part of `size` inside the viewport's CSS padding: where photos fit. */
export function areaOf(viewport: HTMLElement, size: Size): Rect {
  const style = getComputedStyle(viewport);
  const px = (value: string): number => Number.parseFloat(value) || 0;
  const left = px(style.paddingLeft);
  const top = px(style.paddingTop);
  return {
    x: left,
    y: top,
    width: size.width - left - px(style.paddingRight),
    height: size.height - top - px(style.paddingBottom),
  };
}

export function measure(s: Session, viewport: HTMLElement): void {
  const box = viewport.getBoundingClientRect();
  s.origin = { x: box.left, y: box.top };
  s.size = { width: box.width, height: box.height };
  s.area = areaOf(viewport, s.size);
}

export const fitOf = (s: Session, slide: SlideEl): Rect | null =>
  slide.data.aspect ? fit(slide.data.aspect, s.area) : null;

/** The wrapper's own size: the fit size at the zoom it was last sized for. */
export const wrapperSize = (slide: SlideEl, f: Rect): Size => ({
  width: f.width * slide.base,
  height: f.height * slide.base,
});

/**
 * Makes `index` current after moving `shift` slides (0 for a jump): keeps the slide elements that stay, in
 * their place on screen, creates new neighbours and removes the rest. With two looping slides the other
 * slide has an element on each side.
 */
export function setSlots(s: Session, index: number, shift = 0): void {
  const old: (SlideEl | null)[] = [...s.slots];
  const take = (k: number): SlideEl => {
    const slide = old[k]!;
    old[k] = null;
    return slide;
  };
  const want = neighbours(index, s.slides.length, s.loop);
  // First the elements that are already where the slide will be, then any element of that slide.
  const kept = want.map((i, k) => (i !== null && old[k + shift]?.data.index === i ? take(k + shift) : null));
  s.index = index;
  s.slots = want.map((i, k) => {
    if (i === null) return null;
    const found = old.findIndex((slide) => slide?.data.index === i);
    return kept[k] ?? (found < 0 ? createSlide(s.slides[i]!, s.overlays[s.slides[i]!.type]) : take(found));
  }) as Session["slots"];
  for (const slide of old) slide?.el.remove();
  for (const slide of s.slots) if (slide && slide.el.parentNode !== s.strip) s.strip.append(slide.el);
}

/** Writes every position: the strip, each slide's place in it, and each slide's media. */
export function place(s: Session): void {
  const gap = s.size.width * (1 + GAP);
  s.strip.style.transform = `translateX(${s.stripX}px)`;
  for (const [i, slide] of s.slots.entries()) {
    if (!slide) continue;
    const isCurrent = i === 1;
    slide.el.style.transform = `translateX(${(i - 1) * gap}px)`;
    slide.el.toggleAttribute("data-dlb-current", isCurrent);
    slide.el.setAttribute("aria-hidden", String(!isCurrent));
    slide.el.inert = !isCurrent;
    const f = fitOf(s, slide);
    slide.media.style.visibility = f ? "" : "hidden";
    if (!f) continue;
    const size = wrapperSize(slide, f);
    slide.media.style.width = `${size.width}px`;
    slide.media.style.height = `${size.height}px`;
    slide.media.style.transform = placeAt(viewRect(f, isCurrent ? s.view : FIT_VIEW), size);
  }
}
