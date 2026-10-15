import { describe, expect, test } from "bun:test";
import { initialVideo, type VideoEvent, type VideoState, video } from "../../src/core/video";

const after = (events: VideoEvent[], from: VideoState = initialVideo): VideoState =>
  events.reduce((state, event) => video(state, event).state, from);
const started = (): VideoState => after([{ type: "activate", saveData: false }]);
const playing = (): VideoState => after([{ type: "activate", saveData: false }, { type: "playing" }]);

describe("starting", () => {
  test("activating loads and plays, muted", () => {
    expect(video(initialVideo, { type: "activate", saveData: false })).toEqual({
      state: { phase: "starting", muted: true, loading: true, retried: false },
      effects: [{ type: "load" }, { type: "play" }],
    });
  });

  test("with Save-Data it loads but waits, paused", () => {
    expect(video(initialVideo, { type: "activate", saveData: true })).toEqual({
      state: { phase: "paused", muted: true, loading: false, retried: false },
      effects: [{ type: "load" }],
    });
  });

  test("the playing event makes it playing", () => {
    expect(playing()).toEqual({ phase: "playing", muted: true, loading: false, retried: false });
  });
});

describe("playing and pausing", () => {
  test("toggle pauses a playing video and plays a paused one", () => {
    const paused = video(playing(), { type: "toggle" });
    expect(paused).toEqual({ state: { ...playing(), phase: "paused" }, effects: [{ type: "pause" }] });
    expect(video(paused.state, { type: "toggle" })).toEqual({
      state: { ...paused.state, phase: "starting" },
      effects: [{ type: "play" }],
    });
  });

  test("pause events from elsewhere, such as a custom player, are followed", () => {
    expect(video(playing(), { type: "pause" }).state.phase).toBe("paused");
  });

  test("waiting shows loading until it plays again", () => {
    const waiting = video(playing(), { type: "waiting" }).state;
    expect(waiting.loading).toBe(true);
    expect(video(waiting, { type: "playing" }).state.loading).toBe(false);
  });
});

describe("sound", () => {
  test("toggle-mute flips it", () => {
    expect(video(playing(), { type: "toggle-mute" })).toEqual({
      state: { ...playing(), muted: false },
      effects: [{ type: "mute", muted: false }],
    });
  });

  test("volume events from elsewhere are followed", () => {
    expect(video(playing(), { type: "volume", muted: false }).state.muted).toBe(false);
  });
});

describe("blocked starts", () => {
  test("blocked with sound: mute and retry once", () => {
    const loud: VideoState = { ...started(), muted: false };
    const retry = video(loud, { type: "rejected", error: "NotAllowedError" });
    expect(retry.effects).toEqual([{ type: "mute", muted: true }, { type: "play" }]);
    expect(retry.state).toMatchObject({ phase: "starting", muted: true, retried: true });
    expect(video(retry.state, { type: "rejected", error: "NotAllowedError" }).state.phase).toBe("paused");
  });

  test("blocked while muted (Low Power Mode): paused until a tap", () => {
    expect(video(started(), { type: "rejected", error: "NotAllowedError" })).toEqual({
      state: { ...started(), phase: "paused", loading: false },
      effects: [],
    });
  });

  test("AbortError is ignored", () => {
    expect(video(started(), { type: "rejected", error: "AbortError" })).toEqual({
      state: started(),
      effects: [],
    });
  });

  test("other play() errors and media errors end in error", () => {
    expect(video(started(), { type: "rejected", error: "NotSupportedError" }).state.phase).toBe("error");
    expect(video(playing(), { type: "error" }).state.phase).toBe("error");
  });
});

describe("page visibility and leaving", () => {
  test("a hidden page suspends a playing video, a visible one resumes it", () => {
    const hidden = video(playing(), { type: "hidden" });
    expect(hidden).toEqual({ state: { ...playing(), phase: "suspended" }, effects: [{ type: "pause" }] });
    expect(video(hidden.state, { type: "pause" }).state.phase).toBe("suspended");
    expect(video(hidden.state, { type: "visible" })).toEqual({
      state: { ...playing(), phase: "starting" },
      effects: [{ type: "play" }],
    });
  });

  test("a paused video stays paused when the page comes back", () => {
    const paused = video(playing(), { type: "toggle" }).state;
    expect(after([{ type: "hidden" }, { type: "visible" }], paused).phase).toBe("paused");
  });

  test("deactivate releases it, and late media events change nothing", () => {
    const idle = video(playing(), { type: "deactivate" });
    expect(idle.effects).toEqual([{ type: "release" }]);
    expect(idle.state.phase).toBe("idle");
    expect(video(idle.state, { type: "playing" }).state).toEqual(idle.state);
    expect(video(idle.state, { type: "error" }).state).toEqual(idle.state);
  });
});
