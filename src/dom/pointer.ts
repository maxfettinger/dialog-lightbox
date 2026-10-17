// Pointer events on the viewport go through the gesture state machine; its intents become swipes, pans,
// drags down to close, taps and double taps.
import { clampView, FIT_VIEW, panBounds, type Rect, type View, viewRect } from "../core/geometry.js";
import {
  type GestureInput,
  gesture,
  type Intent,
  type Mode,
  type PointerKind,
  type Target,
} from "../core/gesture.js";
import {
  dismissProgress,
  dismissView,
  project,
  resist,
  rubber,
  shouldDismiss,
  spring,
  swipeDirection,
} from "../core/motion.js";
import { step } from "../core/navigation.js";
import { placeAt, play, stop } from "./animate.js";
import { change, springStrip } from "./navigate.js";
import { current, fitOf, place, type Session, wrapperSize } from "./session.js";
import type { SlideEl } from "./slides.js";
import { backdrop } from "./transitions.js";
import { toggleZoom, zoomOf } from "./zoom.js";

export interface PointerHooks {
  /** The current slide changed after a swipe. */
  changed(): void;
  close(): void;
  sync(): void;
  toggleVideo(): void;
}

type Tap = Extract<Intent, { type: "tap" }>;

const MOVES = { pointermove: "move", pointerup: "up", pointercancel: "cancel" } as const;

export function bindPointer(
  s: Session,
  viewport: HTMLElement,
  dialog: HTMLElement,
  hooks: PointerHooks,
): void {
  /** place() on the next animation frame, at most once per frame. */
  const schedule = (): void => {
    s.frame ||= requestAnimationFrame(() => {
      s.frame = 0;
      place(s);
    });
  };

  /** Stops running animations and takes the state from the screen, so a new drag starts from there. */
  const interrupt = (): void => {
    s.stripX = stop(s.strip).e;
    const slide = current(s);
    const f = fitOf(s, slide);
    if (!f) return;
    // The media's transform is translate(fit + view) scale(view.scale / base).
    const m = stop(slide.media);
    s.view = { scale: m.a * slide.base, x: m.e - f.x, y: m.f - f.y };
    place(s);
  };

  const targetAt = (x: number, y: number): Target => {
    const slide = current(s);
    const f = fitOf(s, slide);
    const r = f ? viewRect(f, s.view) : null;
    const bounds = f ? panBounds(f, s.view.scale, s.size) : null;
    return {
      area: r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height ? "media" : "outside",
      type: slide.data.type,
      zoomable: zoomOf(s, slide) !== null,
      zoomed: s.view.scale > 1.01,
      atLeft: !bounds || s.view.x >= bounds.maxX - 1,
      atRight: !bounds || s.view.x <= bounds.minX + 1,
    };
  };

  const springView = (slide: SlideEl, f: Rect, target: View, vx: number, vy: number): void => {
    const { frames, duration } = spring(
      [s.view.scale, s.view.x, s.view.y],
      [target.scale, target.x, target.y],
      [0, vx, vy],
      12,
    );
    const size = wrapperSize(slide, f);
    s.view = target;
    place(s);
    const keyframes = frames.map(([scale = 1, x = 0, y = 0]) => ({
      transform: placeAt(viewRect(f, { scale, x, y }), size),
    }));
    void play(slide.media, keyframes, duration);
  };

  const drag = (mode: Mode, dx: number, dy: number): void => {
    dialog.toggleAttribute("data-dlb-moving", true);
    // A drag begins with dx = dy = 0: remember where everything was.
    if (dx === 0 && dy === 0) s.from = { stripX: s.stripX, view: s.view };
    const { from } = s;
    const f = fitOf(s, current(s));
    if (mode === "swipe") {
      const x = from.stripX + dx;
      const end = step(s.index, x > 0 ? -1 : 1, s.slides.length, s.loop) === null;
      s.stripX = end ? resist(x, s.size.width) : x;
    } else if (f && mode === "pan") {
      const b = panBounds(f, from.view.scale, s.size);
      s.view = {
        scale: from.view.scale,
        x: rubber(from.view.x + dx, b.minX, b.maxX, s.size.width),
        y: rubber(from.view.y + dy, b.minY, b.maxY, s.size.height),
      };
    } else if (f) {
      dialog.toggleAttribute("data-dlb-animating", true);
      const progress = dismissProgress(dy, s.size.height);
      s.view = dismissView(f, dx, dy, progress);
      dialog.style.setProperty("--dlb-opacity", String(1 - progress));
    }
    schedule();
  };

  const release = (mode: Mode, dx: number, dy: number, vx: number, vy: number): void => {
    land(mode, dx, dy, vx, vy);
    // Without motion nothing animates afterwards, so say here that the media have settled.
    hooks.sync();
  };

  const land = (mode: Mode, dx: number, dy: number, vx: number, vy: number): void => {
    if (mode === "swipe") {
      const direction = swipeDirection(dx, vx, s.size.width);
      if (direction === 0) void springStrip(s, 0, vx);
      else change(s, direction, vx, hooks.changed);
      return;
    }
    const slide = current(s);
    const f = fitOf(s, slide);
    if (!f) return;
    if (mode === "pan") {
      const thrown = { scale: s.view.scale, x: s.view.x + project(vx), y: s.view.y + project(vy) };
      springView(slide, f, clampView(thrown, panBounds(f, s.view.scale, s.size)), vx, vy);
    } else if (shouldDismiss(dy, vy, s.size.height)) {
      hooks.close();
    } else {
      dialog.removeAttribute("data-dlb-animating");
      springView(slide, f, FIT_VIEW, vx, vy);
      void backdrop(dialog, 1);
    }
  };

  const tap = ({ x, y, kind, target }: Tap): void => {
    if (target.area === "outside") {
      hooks.close();
    } else if (target.type === "video") {
      hooks.toggleVideo();
    } else if (kind !== "mouse") {
      s.uiHidden = !s.uiHidden;
      hooks.sync();
    } else if (target.zoomable) {
      void toggleZoom(s, hooks.sync, { x, y });
    } else {
      hooks.close();
    }
  };

  const handle = (intent: Intent): void => {
    if (intent.type === "drag") drag(intent.mode, intent.dx, intent.dy);
    else if (intent.type === "release") release(intent.mode, intent.dx, intent.dy, intent.vx, intent.vy);
    else if (intent.type === "abort") release(intent.mode, 0, 0, 0, 0);
    else if (intent.type === "tap") tap(intent);
    else void toggleZoom(s, hooks.sync, intent);
  };

  const feed = (input: GestureInput): void => {
    const result = gesture(s.gesture, input);
    s.gesture = result.state;
    if (result.timer !== undefined) {
      clearTimeout(s.timer);
      if (result.timer !== null)
        s.timer = setTimeout(() => feed({ type: "timeout", t: performance.now() }), result.timer);
    }
    for (const intent of result.intents) handle(intent);
  };

  const onPointer = (event: PointerEvent): void => {
    if (s.busy || s.closing) return;
    const x = event.clientX - s.origin.x;
    const y = event.clientY - s.origin.y;
    const kind: PointerKind =
      event.pointerType === "touch" || event.pointerType === "pen" ? event.pointerType : "mouse";
    const pointer = { id: event.pointerId, x, y, t: event.timeStamp, kind };
    if (event.type !== "pointerdown") {
      feed({ ...pointer, type: MOVES[event.type as keyof typeof MOVES] });
      return;
    }
    if (kind === "mouse" && event.button !== 0) return;
    // A button or link in an overlay handles its own click.
    if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea")) return;
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers, as in the tests, can't be captured.
    }
    interrupt();
    feed({ ...pointer, type: "down", target: targetAt(x, y) });
  };

  const options = { signal: s.abort.signal };
  viewport.addEventListener("pointerdown", onPointer, options);
  viewport.addEventListener("pointermove", onPointer, options);
  viewport.addEventListener("pointerup", onPointer, options);
  viewport.addEventListener("pointercancel", onPointer, options);
}
