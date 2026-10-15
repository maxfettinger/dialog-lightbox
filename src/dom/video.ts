// The one <video> element of a lightbox. It moves into the current video slide, plays without native controls,
// and reports through the core state machine; the element's own events are the source of truth.
import {
  initialVideo,
  video as next,
  type VideoEffect,
  type VideoEvent,
  type VideoState,
} from "../core/video";
import { FILL } from "./slides";

export interface VideoController {
  readonly element: HTMLVideoElement;
  readonly state: VideoState;
  /** Moves the element into `container`, loads `src` and starts it. Call it inside the user's event. */
  activate(container: HTMLElement, src: string, progress: HTMLElement[]): void;
  /** Stops and releases the video; does nothing when idle. */
  deactivate(): void;
  /** Pauses without releasing, for the closing animation. */
  pause(): void;
  send(event: VideoEvent): void;
}

type SaveData = { connection?: { saveData?: boolean } };

export function createVideo(onChange: () => void, signal: AbortSignal): VideoController {
  const element = document.createElement("video");
  // The muted property, not the attribute: an attribute added by a script doesn't mute.
  element.muted = true;
  element.loop = true;
  element.playsInline = true;
  element.preload = "metadata";
  for (const name of ["playsinline", "disablepictureinpicture", "disableremoteplayback"])
    element.setAttribute(name, "");
  element.style.cssText = `${FILL};opacity:0`;
  let state = initialVideo;
  let src = "";
  let progress: HTMLElement[] = [];
  let ticking = false;

  const send = (event: VideoEvent): void => {
    const result = next(state, event);
    state = result.state;
    for (const effect of result.effects) run(effect);
    onChange();
  };

  const run = (effect: VideoEffect): void => {
    if (effect.type === "load") {
      element.style.opacity = "0";
      element.src = src;
      // Invisible over the poster until a frame is painted, so there is no black flash.
      element.requestVideoFrameCallback(() => {
        element.style.opacity = "1";
      });
    } else if (effect.type === "play") {
      element.play().catch((error: unknown) => {
        send({ type: "rejected", error: error instanceof DOMException ? error.name : "Error" });
      });
    } else if (effect.type === "pause") {
      element.pause();
    } else if (effect.type === "release") {
      element.pause();
      element.removeAttribute("src");
      element.load();
      element.remove();
    } else {
      element.muted = effect.muted;
    }
  };

  /** Writes --dlb-progress on every painted frame while playing. */
  const tick = (): void => {
    const value = element.duration ? element.currentTime / element.duration : 0;
    for (const bar of progress) bar.style.setProperty("--dlb-progress", String(value));
    ticking = !element.paused && element.isConnected;
    if (ticking) element.requestVideoFrameCallback(tick);
  };

  const listen = (type: string, handler: () => void): void =>
    element.addEventListener(type, handler, { signal });
  listen("playing", () => {
    send({ type: "playing" });
    if (!ticking) tick();
  });
  listen("pause", () => send({ type: "pause" }));
  listen("waiting", () => send({ type: "waiting" }));
  listen("error", () => send({ type: "error" }));
  listen("volumechange", () => {
    if (element.muted !== state.muted) send({ type: "volume", muted: element.muted });
  });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (state.phase !== "idle") send({ type: document.hidden ? "hidden" : "visible" });
    },
    { signal },
  );

  return {
    element,
    get state() {
      return state;
    },
    activate(container, url, bars) {
      src = url;
      progress = bars;
      container.append(element);
      send({ type: "activate", saveData: Boolean((navigator as Navigator & SaveData).connection?.saveData) });
    },
    deactivate() {
      if (state.phase !== "idle") send({ type: "deactivate" });
    },
    pause() {
      element.pause();
    },
    send,
  };
}
