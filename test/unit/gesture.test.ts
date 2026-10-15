import { describe, expect, test } from "bun:test";
import {
  type GestureInput,
  type GestureState,
  type GestureStep,
  gesture,
  type Intent,
  initialGesture,
  type PointerKind,
  type Target,
} from "../../src/core/gesture";

const photo: Target = {
  area: "media",
  type: "image",
  zoomable: false,
  zoomed: false,
  atLeft: true,
  atRight: true,
};
const zoomable: Target = { ...photo, zoomable: true };

function down(
  x: number,
  y: number,
  t: number,
  target = photo,
  kind: PointerKind = "touch",
  id = 1,
): GestureInput {
  return { type: "down", id, x, y, t, kind, target };
}

function at(
  type: "move" | "up" | "cancel",
  x: number,
  y: number,
  t: number,
  id = 1,
  kind: PointerKind = "touch",
): GestureInput {
  return { type, id, x, y, t, kind };
}

/** Feeds the inputs in order: the last state, every intent, and the last timer request. */
function run(inputs: GestureInput[], start: GestureState = initialGesture) {
  let state = start;
  const intents: Intent[] = [];
  let timer: GestureStep["timer"];
  for (const input of inputs) {
    const result = gesture(state, input);
    state = result.state;
    intents.push(...result.intents);
    if (result.timer !== undefined) timer = result.timer;
  }
  return { state, intents, timer };
}

describe("taps", () => {
  test("a quick press without movement is a tap", () => {
    const { state, intents } = run([down(100, 100, 0), at("up", 102, 101, 80)]);
    expect(intents).toEqual([{ type: "tap", x: 102, y: 101, kind: "touch", target: photo }]);
    expect(state.phase).toBe("idle");
  });

  test("movement under the 10 px slop still ends in a tap", () => {
    const { intents } = run([down(100, 100, 0), at("move", 106, 105, 30), at("up", 106, 105, 60)]);
    expect(intents.map((intent) => intent.type)).toEqual(["tap"]);
  });

  test("a press longer than 300 ms is no tap", () => {
    expect(run([down(100, 100, 0), at("up", 100, 100, 400)]).intents).toEqual([]);
  });

  test("a tap on a zoomable photo waits 300 ms for a second tap", () => {
    const first = run([down(100, 100, 0, zoomable), at("up", 100, 100, 50)]);
    expect(first.intents).toEqual([]);
    expect(first.timer).toBe(300);
    const later = gesture(first.state, { type: "timeout", t: 350 });
    expect(later.intents).toEqual([{ type: "tap", x: 100, y: 100, kind: "touch", target: zoomable }]);
  });

  test("two taps close together are a double tap", () => {
    const { intents, timer } = run([
      down(100, 100, 0, zoomable),
      at("up", 100, 100, 50),
      down(110, 105, 150, zoomable),
      at("up", 110, 105, 200),
    ]);
    expect(intents).toEqual([{ type: "double-tap", x: 110, y: 105, target: zoomable }]);
    expect(timer).toBeNull();
  });

  test("a second tap far away lets the first one stand alone", () => {
    const { intents, timer, state } = run([
      down(100, 100, 0, zoomable),
      at("up", 100, 100, 50),
      down(200, 100, 150, zoomable),
      at("up", 200, 100, 200),
    ]);
    expect(intents).toEqual([{ type: "tap", x: 100, y: 100, kind: "touch", target: zoomable }]);
    expect(timer).toBe(300);
    expect(state.pending?.x).toBe(200);
  });

  test("mouse clicks act at once, even on zoomable photos", () => {
    const { intents, timer } = run([
      down(100, 100, 0, zoomable, "mouse"),
      at("up", 100, 100, 50, 1, "mouse"),
    ]);
    expect(intents).toEqual([{ type: "tap", x: 100, y: 100, kind: "mouse", target: zoomable }]);
    expect(timer).toBeUndefined();
  });

  test("a press that turns into a drag lets a waiting tap go first", () => {
    const { intents, timer } = run([
      down(100, 100, 0, zoomable),
      at("up", 100, 100, 50),
      down(100, 100, 100, zoomable),
      at("move", 70, 100, 120),
    ]);
    expect(intents.map((intent) => intent.type)).toEqual(["tap", "drag"]);
    expect(timer).toBeNull();
  });
});

describe("drags", () => {
  test("horizontal movement past the slop is a swipe, counted from where it was recognised", () => {
    const { intents } = run([
      down(200, 300, 0),
      at("move", 185, 300, 16),
      at("move", 150, 300, 32),
      at("up", 150, 300, 48),
    ]);
    expect(intents[0]).toEqual({ type: "drag", mode: "swipe", dx: 0, dy: 0 });
    expect(intents[1]).toEqual({ type: "drag", mode: "swipe", dx: -35, dy: 0 });
    const release = intents[2];
    if (release?.type !== "release") throw new Error("expected a release");
    expect(release.dx).toBe(-35);
    expect(release.vx).toBeCloseTo(-50 / 48);
    expect(release.vy).toBe(0);
  });

  test("a drag down is a dismiss", () => {
    expect(run([down(195, 400, 0), at("move", 195, 420, 16)]).intents).toEqual([
      { type: "drag", mode: "dismiss", dx: 0, dy: 0 },
    ]);
  });

  test("a drag up does nothing", () => {
    const { intents, state } = run([
      down(195, 400, 0),
      at("move", 195, 380, 16),
      at("move", 195, 300, 32),
      at("up", 195, 300, 48),
    ]);
    expect(intents).toEqual([]);
    expect(state.phase).toBe("idle");
  });

  test("zoomed photos pan in every direction", () => {
    const zoomed = { ...zoomable, zoomed: true, atLeft: false, atRight: false };
    expect(run([down(200, 300, 0, zoomed), at("move", 170, 300, 16)]).intents[0]).toMatchObject({
      mode: "pan",
    });
    expect(run([down(200, 300, 0, zoomed), at("move", 200, 330, 16)]).intents[0]).toMatchObject({
      mode: "pan",
    });
  });

  test("at the right edge of a zoomed photo, dragging left swipes", () => {
    const atRight = { ...zoomable, zoomed: true, atLeft: false, atRight: true };
    expect(run([down(200, 300, 0, atRight), at("move", 170, 300, 16)]).intents[0]).toMatchObject({
      mode: "swipe",
    });
    expect(run([down(200, 300, 0, atRight), at("move", 230, 300, 16)]).intents[0]).toMatchObject({
      mode: "pan",
    });
  });

  test("velocity only counts the last 100 ms", () => {
    const { intents } = run([
      down(300, 300, 0),
      at("move", 290, 300, 100),
      at("move", 280, 300, 200),
      at("move", 279, 300, 300),
      at("move", 230, 300, 316),
      at("up", 230, 300, 332),
    ]);
    const release = intents.at(-1);
    if (release?.type !== "release") throw new Error("expected a release");
    expect(release.vx).toBeCloseTo(-49 / 32);
  });
});

describe("interruptions", () => {
  test("a second finger aborts the drag and blocks until every finger is up", () => {
    const blocked = run([down(200, 300, 0), at("move", 170, 300, 16), down(100, 300, 20, photo, "touch", 2)]);
    expect(blocked.intents.at(-1)).toEqual({ type: "abort", mode: "swipe" });
    expect(blocked.state.phase).toBe("blocked");
    const oneUp = run([at("up", 170, 300, 40)], blocked.state);
    expect(oneUp.state.phase).toBe("blocked");
    const allUp = run([at("move", 100, 300, 50, 2), at("up", 100, 300, 60, 2)], oneUp.state);
    expect(allUp.intents).toEqual([]);
    expect(allUp.state.phase).toBe("idle");
  });

  test("pointercancel aborts a drag without a tap", () => {
    const { intents, state } = run([down(200, 300, 0), at("move", 170, 300, 16), at("cancel", 170, 300, 20)]);
    expect(intents.at(-1)).toEqual({ type: "abort", mode: "swipe" });
    expect(state.phase).toBe("idle");
  });

  test("pointercancel during a press gives no tap", () => {
    expect(run([down(200, 300, 0), at("cancel", 200, 300, 20)]).intents).toEqual([]);
  });

  test("moves of other pointers are ignored", () => {
    expect(run([down(200, 300, 0), at("move", 100, 300, 16, 2)]).intents).toEqual([]);
  });
});
