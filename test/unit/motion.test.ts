import { describe, expect, test } from "bun:test";
import {
  dismissProgress,
  dismissView,
  project,
  resist,
  rubber,
  shouldDismiss,
  spring,
  swipeDirection,
} from "../../src/core/motion";

describe("project", () => {
  test("momentum carries about 199 times the velocity", () => {
    expect(project(1)).toBeCloseTo(199);
    expect(project(-0.5)).toBeCloseTo(-99.5);
  });
});

describe("resist and rubber", () => {
  test("resistance grows slower than the finger and stays under the dimension", () => {
    expect(resist(0, 100)).toBe(0);
    expect(resist(50, 100)).toBeCloseTo(21.57, 1);
    expect(resist(10_000, 100)).toBeLessThan(100);
    expect(resist(-50, 100)).toBeCloseTo(-resist(50, 100));
  });

  test("rubber leaves values inside the range alone", () => {
    expect(rubber(5, 0, 10, 100)).toBe(5);
    expect(rubber(-50, 0, 10, 100)).toBeCloseTo(-21.57, 1);
    expect(rubber(60, 0, 10, 100)).toBeCloseTo(10 + 21.57, 1);
  });
});

describe("spring", () => {
  test("starts at the start values and ends exactly on the targets", () => {
    const { frames, duration } = spring([400, 10], [0, 10], [0, 0], 30);
    expect(frames).toHaveLength(31);
    expect(frames[0]).toEqual([400, 10]);
    expect(frames.at(-1)).toEqual([0, 10]);
    expect(duration).toBeGreaterThan(200);
    expect(duration).toBeLessThan(400);
  });

  test("without velocity a critically damped spring never overshoots", () => {
    const { frames } = spring([100], [0], [0], 30);
    expect(Math.min(...frames.map((frame) => frame[0] ?? 0))).toBeGreaterThanOrEqual(0);
  });

  test("a fast release toward the target overshoots once", () => {
    const { frames } = spring([100], [0], [-5], 30);
    expect(Math.min(...frames.map((frame) => frame[0] ?? 0))).toBeLessThan(0);
  });

  test("nothing to move takes no time", () => {
    expect(spring([5], [5], [0], 30).duration).toBe(0);
  });
});

describe("swipeDirection", () => {
  test("a fast flick decides by its direction", () => {
    expect(swipeDirection(-20, -0.8, 400)).toBe(1);
    expect(swipeDirection(20, 0.8, 400)).toBe(-1);
  });

  test("a slow drag past half the width changes the slide", () => {
    expect(swipeDirection(-210, -0.1, 400)).toBe(1);
    expect(swipeDirection(210, 0.1, 400)).toBe(-1);
  });

  test("a flick back against the drag cancels it", () => {
    expect(swipeDirection(-260, 2, 400)).toBe(0);
    expect(swipeDirection(260, -2, 400)).toBe(0);
    expect(swipeDirection(-60, 0.8, 400)).toBe(0);
  });

  test("a flick without a drag decides by its direction", () => {
    expect(swipeDirection(0, -0.8, 400)).toBe(1);
  });

  test("a short slow drag stays", () => {
    expect(swipeDirection(-150, -0.2, 400)).toBe(0);
  });
});

describe("drag down to close", () => {
  test("progress reaches 1 after a third of the height", () => {
    expect(dismissProgress(0, 900)).toBe(0);
    expect(dismissProgress(150, 900)).toBe(0.5);
    expect(dismissProgress(600, 900)).toBe(1);
    expect(dismissProgress(-50, 900)).toBe(0);
  });

  test("closes past 13% of the height, or earlier with a flick", () => {
    expect(shouldDismiss(120, 0, 800)).toBe(true);
    expect(shouldDismiss(50, 0, 800)).toBe(false);
    expect(shouldDismiss(0, 1, 800)).toBe(true);
  });

  test("the media follow the finger and shrink around their center", () => {
    const view = dismissView({ width: 400, height: 300 }, 10, 100, 0.5);
    expect(view.scale).toBeCloseTo(0.9);
    expect(view.x).toBeCloseTo(30);
    expect(view.y).toBeCloseTo(115);
  });
});
