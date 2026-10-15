// The video state machine. The media element's own events are the source of truth, so a custom player that
// calls play() or pause() itself stays in sync. Effects tell the DOM shell what to do.

export type VideoPhase = "idle" | "starting" | "playing" | "paused" | "suspended" | "error";

export interface VideoState {
  phase: VideoPhase;
  muted: boolean;
  /** Buffering: waiting for data. */
  loading: boolean;
  /** A start with sound was blocked once and retried muted. */
  retried: boolean;
}

export type VideoEvent =
  | { type: "activate"; saveData: boolean }
  | { type: "deactivate" }
  | { type: "toggle" }
  | { type: "toggle-mute" }
  | { type: "playing" }
  | { type: "pause" }
  | { type: "waiting" }
  | { type: "volume"; muted: boolean }
  // play() was rejected; error is the DOMException's name.
  | { type: "rejected"; error: string }
  | { type: "error" }
  | { type: "hidden" }
  | { type: "visible" };

export type VideoEffect =
  | { type: "load" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "release" }
  | { type: "mute"; muted: boolean };

export interface VideoStep {
  state: VideoState;
  effects: VideoEffect[];
}

export const initialVideo: VideoState = { phase: "idle", muted: true, loading: false, retried: false };

const just = (state: VideoState): VideoStep => ({ state, effects: [] });
const running = (s: VideoState): boolean => s.phase === "playing" || s.phase === "starting";

export function video(s: VideoState, e: VideoEvent): VideoStep {
  switch (e.type) {
    case "activate":
      return e.saveData
        ? { state: { ...s, phase: "paused", loading: false, retried: false }, effects: [{ type: "load" }] }
        : {
            state: { ...s, phase: "starting", loading: true, retried: false },
            effects: [{ type: "load" }, { type: "play" }],
          };
    case "deactivate":
      return { state: { ...s, phase: "idle", loading: false }, effects: [{ type: "release" }] };
    case "toggle":
      if (running(s))
        return { state: { ...s, phase: "paused", loading: false }, effects: [{ type: "pause" }] };
      if (s.phase === "paused") return { state: { ...s, phase: "starting" }, effects: [{ type: "play" }] };
      return just(s);
    case "toggle-mute":
      return { state: { ...s, muted: !s.muted }, effects: [{ type: "mute", muted: !s.muted }] };
    case "playing":
      return just(s.phase === "idle" ? s : { ...s, phase: "playing", loading: false });
    case "pause":
      return just(running(s) ? { ...s, phase: "paused", loading: false } : s);
    case "waiting":
      return just(s.phase === "idle" ? s : { ...s, loading: true });
    case "volume":
      return just({ ...s, muted: e.muted });
    case "rejected":
      return rejected(s, e.error);
    case "error":
      return just(s.phase === "idle" ? s : { ...s, phase: "error", loading: false });
    case "hidden":
      return running(s) ? { state: { ...s, phase: "suspended" }, effects: [{ type: "pause" }] } : just(s);
    case "visible":
      return s.phase === "suspended"
        ? { state: { ...s, phase: "starting" }, effects: [{ type: "play" }] }
        : just(s);
  }
}

function rejected(s: VideoState, error: string): VideoStep {
  // AbortError: a newer pause() or load() interrupted play(); nothing to do.
  if (error === "AbortError" || s.phase === "idle") return just(s);
  if (error !== "NotAllowedError") return just({ ...s, phase: "error", loading: false });
  // Blocked with sound: mute and try once more. Blocked while muted (Low Power Mode): wait for a tap.
  if (!s.muted && !s.retried) {
    return {
      state: { ...s, phase: "starting", muted: true, retried: true },
      effects: [{ type: "mute", muted: true }, { type: "play" }],
    };
  }
  return just({ ...s, phase: "paused", loading: false });
}
