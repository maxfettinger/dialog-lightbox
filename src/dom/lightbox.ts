// lightbox(): wires a gallery of links to a <dialog>. Each opening is a session (session.ts) that the other
// dom/ modules work on; closing drops it and removes its listeners with one abort() call.
import { FIT_VIEW, viewRect } from "../core/geometry.js";
import { step } from "../core/navigation.js";
import { clear, findControls, render, reset } from "./controls.js";
import { createHistory, hashId } from "./history.js";
import { readSlide, readSlides, type SlideData } from "./links.js";
import { change } from "./navigate.js";
import { bindPointer } from "./pointer.js";
import {
  createSession,
  current,
  fitOf,
  measure,
  type Overlays,
  place,
  type Session,
  setSlots,
} from "./session.js";
import { loadLarge, preload, type SlideEl } from "./slides.js";
import { zoomBox } from "./transitions.js";
import { createVideo } from "./video.js";
import { toggleZoom, zoomOf } from "./zoom.js";

export interface LightboxOptions {
  gallery: HTMLElement;
  dialog: HTMLDialogElement;
  loop?: boolean;
  history?: boolean;
}

export interface Slide {
  index: number;
  id: string;
  type: "image" | "video";
  link: HTMLAnchorElement;
}

export type LightboxEvent = "open" | "change" | "close";

export interface Lightbox {
  open(index?: number): void;
  close(): void;
  goTo(index: number): void;
  next(): void;
  prev(): void;
  readonly current: Slide | null;
  readonly count: number;
  readonly video: HTMLVideoElement;
  on(type: LightboxEvent, handler: (slide: Slide) => void): () => void;
  destroy(): void;
}

let instances = 0;
/** How many lightboxes use each dialog, so the last destroy() can clean up after all of them. */
const users = new WeakMap<HTMLDialogElement, number>();

export function lightbox(options: LightboxOptions): Lightbox {
  const { gallery, dialog, loop = false } = options;
  const found = dialog.querySelector<HTMLElement>("[data-dlb-viewport]");
  if (!found) throw new Error("dialog-lightbox: the dialog has no [data-dlb-viewport] element");
  const viewport: HTMLElement = found;
  dialog.setAttribute("data-dlb", "");
  users.set(dialog, (users.get(dialog) ?? 0) + 1);
  // The viewport takes focus on open, so keys reach the box and not the dialog's first button.
  viewport.tabIndex = -1;
  const galleryId = gallery.id || `g${++instances}`;
  const life = new AbortController();
  const handlers: Record<LightboxEvent, Set<(slide: Slide) => void>> = {
    open: new Set(),
    change: new Set(),
    close: new Set(),
  };
  let s: Session | null = null;
  /** The last input in the box was a key: closing then shows the focus ring on the thumbnail. */
  let keyed = false;
  /** Moves asked for during the opening animation, made once it ends. */
  const queue: (() => void)[] = [];
  const video = createVideo(() => sync(), life.signal);
  // A video without a known size is sized from its own metadata.
  video.element.addEventListener(
    "loadedmetadata",
    () => {
      const { videoWidth: width, videoHeight: height } = video.element;
      if (!s || current(s).data.type !== "video" || current(s).data.aspect || !width || !height) return;
      current(s).data.aspect = { width, height };
      place(s);
      sync();
    },
    { signal: life.signal },
  );
  const hist = options.history === false ? null : createHistory(() => void close(true), life.signal);

  const links = (): HTMLAnchorElement[] => [...gallery.querySelectorAll<HTMLAnchorElement>("a[href]")];
  const toSlide = ({ index, id, type, link }: SlideData): Slide => ({ index, id, type, link });
  const emit = (event: LightboxEvent, data: SlideData): void => {
    for (const handler of handlers[event]) handler(toSlide(data));
  };

  /** Writes the state attributes and the buttons' state for the current slide. */
  function sync(): void {
    if (!s) return;
    const slide = current(s);
    const isVideo = slide.data.type === "video";
    const v = video.state;
    render(dialog, findControls(dialog), {
      type: slide.data.type,
      index: s.index,
      count: s.slides.length,
      first: step(s.index, -1, s.slides.length, loop) === null,
      last: step(s.index, 1, s.slides.length, loop) === null,
      loading: isVideo ? v.loading : slide.status === "loading",
      error: isVideo ? v.phase === "error" : slide.status === "error",
      zoomable: zoomOf(s, slide) !== null,
      zoomed: s.view.scale > 1.01,
      uiHidden: s.uiHidden,
      paused: isVideo && v.phase !== "playing" && v.phase !== "starting",
      muted: v.muted,
      noaudio: isVideo && !slide.data.audio,
      fullscreen: isVideo && video.canFullscreen,
    });
    settle();
  }

  /** Once nothing moves: the current media's rectangle in --dlb-media-*, and data-dlb-moving off. */
  function settle(): void {
    if (!s || s.closing || s.gesture.phase === "dragging") return;
    if (dialog.getAnimations({ subtree: true }).some((a) => a.constructor === Animation)) return;
    const f = fitOf(s, current(s));
    if (f) {
      const r = viewRect(f, s.view);
      for (const [name, value] of Object.entries(r))
        dialog.style.setProperty(`--dlb-media-${name}`, `${value}px`);
    }
    dialog.removeAttribute("data-dlb-moving");
  }

  /** Loads the current slide's large image first, then its neighbours'. */
  async function loadAround(session: Session): Promise<void> {
    const [prev, now, next] = session.slots;
    await load(session, now);
    await Promise.all([load(session, prev), load(session, next)]);
  }

  async function load(session: Session, slide: SlideEl | null): Promise<void> {
    if (!slide) return;
    await loadLarge(slide);
    if (s !== session) return;
    place(session);
    sync();
  }

  /** Starts the slide's video, with the progress bars in the dialog and in the slide's own overlay. */
  function play(slide: SlideEl): void {
    const bars = [...dialog.querySelectorAll<HTMLElement>("[data-dlb-progress]")].filter(
      (bar) => !bar.closest("[data-dlb-slide]") || slide.el.contains(bar),
    );
    video.activate(slide.media, slide.data.src, bars);
  }

  /** After the current slide changed: video, events, state, loading. */
  function changed(): void {
    if (!s) return;
    const slide = current(s);
    video.deactivate();
    if (slide.data.type === "video") play(slide);
    hist?.change(slide.data.id);
    emit("change", slide.data);
    sync();
    void loadAround(s);
  }

  function go(direction: -1 | 1): void {
    if (!s || s.closing) return;
    if (s.busy) queue.push(() => go(direction));
    else change(s, direction, 0, changed);
  }

  function onKey(event: KeyboardEvent): void {
    keyed = true;
    if (!s || s.closing || event.altKey || event.metaKey || event.ctrlKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, select, textarea")) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      go(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    // Space and M on a video, unless a button has focus: Space would press it as well and toggle twice.
    const action = event.key === " " ? "toggle" : event.key.toLowerCase() === "m" ? "toggle-mute" : null;
    if (action && current(s).data.type === "video" && !target?.closest("button")) {
      event.preventDefault();
      video.send({ type: action });
    }
  }

  /** `deep`: opened from a #dlb=<id> URL, so there is no history entry to add. */
  function open(index: number, deep = false): void {
    // One box per dialog, and none after destroy().
    if (s || dialog.open || life.signal.aborted) return;
    const slides = readSlides(gallery, galleryId);
    if (!slides[index]) return;
    // Set before the slides exist, so an overlay starts hidden and fades in after the zoom.
    dialog.toggleAttribute("data-dlb-animating", true);
    dialog.showModal();
    viewport.focus({ preventScroll: true });
    const overlays: Overlays = {};
    for (const template of dialog.querySelectorAll<HTMLTemplateElement>("template[data-dlb-overlay]")) {
      const type = template.dataset.dlbOverlay;
      if (type !== "video") overlays.image ??= template;
      if (type !== "image") overlays.video ??= template;
    }
    queue.length = 0;
    keyed = false;
    const session = createSession(slides, index, loop, viewport, overlays);
    s = session;
    session.busy = true;
    bind(session);
    const slide = current(session);
    // Still inside the user's click, so iOS lets the video start.
    if (slide.data.type === "video") play(slide);
    hist?.open(slide.data.id, deep);
    emit("open", slide.data);
    emit("change", slide.data);
    sync();
    void loadAround(session);
    void zoomBox(session, dialog, true).then(() => {
      session.busy = false;
      if (session.closing) return;
      dialog.removeAttribute("data-dlb-animating");
      for (const move of queue.splice(0)) move();
    });
  }

  /** The session's listeners, all removed by session.abort.abort(). */
  function bind(session: Session): void {
    const { signal } = session.abort;
    // One listener for the buttons, so copies in overlays work like the ones in the dialog.
    const actions: Record<string, () => void> = {
      close: () => void close(),
      prev: () => go(-1),
      next: () => go(1),
      zoom: () => void toggleZoom(session, sync),
      play: () => video.send({ type: "toggle" }),
      mute: () => video.send({ type: "toggle-mute" }),
      fullscreen: () => {
        if (current(session).data.type === "video") video.fullscreen();
      },
    };
    dialog.addEventListener(
      "click",
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        for (const name in actions) if (target?.closest(`[data-dlb-${name}]`)) actions[name]!();
      },
      { signal },
    );
    // On the document: when a focused button disappears (an overlay on a slide that turned inert, the
    // fullscreen player closing), focus falls back to the body, and the keys must still work.
    document.addEventListener("keydown", onKey, { signal });
    dialog.addEventListener("pointerdown", () => (keyed = false), { signal });
    dialog.addEventListener("dlbmove", () => dialog.toggleAttribute("data-dlb-moving", true), { signal });
    dialog.addEventListener("dlbsettle", settle, { signal });
    dialog.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        void close();
      },
      { signal },
    );
    // The browser closed the dialog itself, after an Escape it didn't let us cancel.
    dialog.addEventListener("close", () => finish(), { signal });
    const resize = new ResizeObserver(() => {
      // The first callback comes right after observe() without any change: keep the zoom then.
      const before = `${session.size.width} ${session.size.height} ${session.area.width} ${session.area.height}`;
      measure(session, viewport);
      if (
        before === `${session.size.width} ${session.size.height} ${session.area.width} ${session.area.height}`
      ) {
        return;
      }
      current(session).base = 1;
      session.view = FIT_VIEW;
      place(session);
      sync();
    });
    resize.observe(viewport);
    signal.addEventListener("abort", () => resize.disconnect());
    bindPointer(session, viewport, dialog, {
      changed,
      close: () => void close(),
      sync,
      toggleVideo: () => video.send({ type: "toggle" }),
    });
  }

  /** Closes with the zoom back to the thumbnail. `fromBack`: the back button already removed the entry. */
  async function close(fromBack = false): Promise<void> {
    const session = s;
    if (!session || session.closing) return;
    session.closing = true;
    dialog.toggleAttribute("data-dlb-animating", true);
    if (!fromBack) hist?.close();
    video.pause();
    await zoomBox(session, dialog, false);
    finish();
  }

  /** Ends the session at once. */
  function finish(): void {
    const session = s;
    if (!session) return;
    // The browser closed the dialog itself (an Escape we couldn't cancel): the history entry is still there.
    if (!session.closing) hist?.close();
    s = null;
    video.deactivate();
    session.abort.abort();
    session.strip.remove();
    clear(dialog);
    for (const name of ["x", "y", "width", "height"]) dialog.style.removeProperty(`--dlb-media-${name}`);
    if (dialog.open) dialog.close();
    const slide = current(session);
    // Firefox may have focused the link already when the dialog closed; blur() lets focusVisible apply.
    slide.data.link.blur();
    slide.data.link.focus({ preventScroll: true, focusVisible: keyed });
    emit("close", slide.data);
  }

  /** Moves to any slide: a neighbour with the slide animation, any other as a jump. */
  function goTo(index: number): void {
    if (!s || s.closing || !s.slides[index]) return;
    if (s.busy) {
      queue.push(() => goTo(index));
      return;
    }
    if (index === s.index) return;
    const forward = index === step(s.index, 1, s.slides.length, loop);
    if (forward || index === step(s.index, -1, s.slides.length, loop)) {
      change(s, forward ? 1 : -1, 0, changed);
      return;
    }
    current(s).base = 1;
    s.view = FIT_VIEW;
    s.stripX = 0;
    setSlots(s, index);
    place(s);
    changed();
  }

  gallery.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const index = links().indexOf(link as HTMLAnchorElement);
      if (index < 0) return;
      event.preventDefault();
      open(index);
    },
    { signal: life.signal },
  );

  gallery.addEventListener(
    "pointerover",
    (event) => {
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      const index = link ? links().indexOf(link) : -1;
      if (event.pointerType !== "mouse" || !link || index < 0) return;
      const data = readSlide(link, index, galleryId);
      preload(data);
    },
    { signal: life.signal },
  );

  // The hash changed on a page that is open already (a link to #dlb=<id>, or the address bar).
  if (hist) {
    addEventListener(
      "hashchange",
      () => {
        const id = hashId();
        if (id === null) {
          if (s && !s.closing) void close(true);
          return;
        }
        const index = readSlides(gallery, galleryId).findIndex((data) => data.id === id);
        if (index < 0) return;
        if (s) goTo(index);
        else open(index, true);
      },
      { signal: life.signal },
    );
  }

  // A #dlb=<id> URL opens that slide. On the next frame, so the page can register its handlers first.
  const deepId = hist ? hashId() : null;
  if (deepId) {
    requestAnimationFrame(() => {
      if (life.signal.aborted) return;
      const index = readSlides(gallery, galleryId).findIndex((data) => data.id === deepId);
      if (index >= 0) open(index, true);
    });
  }

  return {
    open: (index = 0) => open(index),
    close: () => void close(),
    goTo,
    next: () => go(1),
    prev: () => go(-1),
    get current() {
      return s ? toSlide(current(s).data) : null;
    },
    video: video.element,
    get count() {
      return s ? s.slides.length : links().length;
    },
    on(type, handler) {
      handlers[type].add(handler);
      return () => {
        handlers[type].delete(handler);
      };
    },
    destroy() {
      if (life.signal.aborted) return;
      finish();
      life.abort();
      const left = users.get(dialog)! - 1;
      users.set(dialog, left);
      if (left) return;
      reset(dialog);
      dialog.removeAttribute("data-dlb");
      dialog.style.removeProperty("--dlb-opacity");
      viewport.removeAttribute("tabindex");
    },
  };
}
