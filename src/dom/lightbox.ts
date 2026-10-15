// lightbox(): wires a gallery of links to a <dialog>. Each opening is a session (session.ts) that the other
// dom/ modules work on; closing drops it and removes its listeners with one abort() call.
import { FIT_VIEW } from "../core/geometry";
import { step } from "../core/navigation";
import { clear, findControls, render } from "./controls";
import { readSlides, type SlideData } from "./links";
import { createSession, current, fitOf, measure, place, type Session } from "./session";
import { loadLarge, type SlideEl } from "./slides";

export interface LightboxOptions {
  gallery: HTMLElement;
  dialog: HTMLDialogElement;
  loop?: boolean;
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
  readonly current: Slide | null;
  readonly count: number;
  on(type: LightboxEvent, handler: (slide: Slide) => void): () => void;
  destroy(): void;
}

let instances = 0;

export function lightbox(options: LightboxOptions): Lightbox {
  const { gallery, dialog, loop = false } = options;
  const found = dialog.querySelector<HTMLElement>("[data-dlb-viewport]");
  if (!found) throw new Error("dialog-lightbox: the dialog has no [data-dlb-viewport] element");
  const viewport: HTMLElement = found;
  dialog.setAttribute("data-dlb", "");
  // The viewport takes focus on open, so keys reach the box and not the dialog's first button.
  viewport.tabIndex = -1;
  const galleryId = gallery.id || `g${++instances}`;
  const controls = findControls(dialog);
  const life = new AbortController();
  const handlers: Record<LightboxEvent, Set<(slide: Slide) => void>> = {
    open: new Set(),
    change: new Set(),
    close: new Set(),
  };
  let s: Session | null = null;

  const links = (): HTMLAnchorElement[] => [...gallery.querySelectorAll<HTMLAnchorElement>("a[href]")];
  const toSlide = ({ index, id, type, link }: SlideData): Slide => ({ index, id, type, link });
  const emit = (event: LightboxEvent, data: SlideData): void => {
    for (const handler of handlers[event]) handler(toSlide(data));
  };

  /** Writes the state attributes and the buttons' state for the current slide. */
  function sync(): void {
    if (!s) return;
    const slide = current(s);
    render(dialog, controls, {
      type: slide.data.type,
      index: s.index,
      count: s.slides.length,
      first: step(s.index, -1, s.slides.length, loop) === null,
      last: step(s.index, 1, s.slides.length, loop) === null,
      loading: slide.status === "loading",
      error: slide.status === "error",
      zoomable: false,
      zoomed: false,
      uiHidden: s.uiHidden,
      paused: false,
      muted: false,
      noaudio: false,
    });
  }

  /** Loads the current slide's large image first, then its neighbours'. */
  async function loadAround(session: Session): Promise<void> {
    const [prev, now, next] = session.slots;
    await load(session, now);
    await Promise.all([load(session, prev), load(session, next)]);
  }

  async function load(session: Session, slide: SlideEl | null): Promise<void> {
    if (!slide) return;
    await loadLarge(slide, (fitOf(session, slide)?.width ?? session.size.width) * slide.base);
    if (s !== session) return;
    place(session);
    sync();
  }

  function open(index: number): void {
    if (s) return;
    const slides = readSlides(gallery, galleryId);
    if (!slides[index]) return;
    dialog.showModal();
    viewport.focus({ preventScroll: true });
    const session = createSession(slides, index, loop, viewport);
    s = session;
    bind(session);
    const slide = current(session);
    emit("open", slide.data);
    emit("change", slide.data);
    place(session);
    dialog.style.setProperty("--dlb-opacity", "1");
    sync();
    void loadAround(session);
  }

  /** The session's listeners, all removed by session.abort.abort(). */
  function bind(session: Session): void {
    const { signal } = session.abort;
    const click = (elements: HTMLElement[], action: () => void): void => {
      for (const element of elements) element.addEventListener("click", action, { signal });
    };
    click(controls.close, () => close());
    dialog.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        close();
      },
      { signal },
    );
    // The browser closed the dialog itself, after an Escape it didn't let us cancel.
    dialog.addEventListener("close", () => finish(), { signal });
    const resize = new ResizeObserver(() => {
      measure(session, viewport);
      current(session).base = 1;
      session.view = FIT_VIEW;
      place(session);
      sync();
    });
    resize.observe(viewport);
    signal.addEventListener("abort", () => resize.disconnect());
  }

  function close(): void {
    const session = s;
    if (!session || session.closing) return;
    session.closing = true;
    finish();
  }

  /** Ends the session at once. */
  function finish(): void {
    const session = s;
    if (!session) return;
    s = null;
    session.abort.abort();
    session.strip.remove();
    clear(dialog);
    if (dialog.open) dialog.close();
    const slide = current(session);
    slide.data.link.focus({ preventScroll: true });
    emit("close", slide.data);
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

  return {
    open: (index = 0) => open(index),
    close: () => close(),
    get current() {
      return s ? toSlide(current(s).data) : null;
    },
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
      finish();
      life.abort();
    },
  };
}
