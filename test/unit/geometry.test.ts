import { describe, expect, test } from "bun:test";
import {
  clampView,
  FIT_VIEW,
  fit,
  mix,
  panBounds,
  thumbStart,
  viewRect,
  zoomAt,
  zoomTarget,
} from "../../src/core/geometry";

describe("fit", () => {
  test("a wide photo fills the width and is centered vertically", () => {
    const r = fit({ width: 1600, height: 1067 }, { x: 0, y: 0, width: 400, height: 800 });
    expect(r.width).toBeCloseTo(400);
    expect(r.height).toBeCloseTo(266.75);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(266.625);
  });

  test("respects the padded area", () => {
    const r = fit({ width: 1000, height: 1000 }, { x: 16, y: 48, width: 368, height: 600 });
    expect(r.x).toBeCloseTo(16);
    expect(r.y).toBeCloseTo(164);
    expect(r.width).toBeCloseTo(368);
    expect(r.height).toBeCloseTo(368);
  });
});

describe("viewRect", () => {
  test("offsets and scales the fit rectangle", () => {
    expect(viewRect({ x: 10, y: 20, width: 100, height: 50 }, { scale: 2, x: -5, y: 5 })).toEqual({
      x: 5,
      y: 25,
      width: 200,
      height: 100,
    });
  });
});

describe("thumbStart", () => {
  test("a cover-cropped portrait thumbnail: the whole photo overflows the box and is clipped back", () => {
    const { rect, clip } = thumbStart(
      { x: 10, y: 20, width: 180, height: 120 },
      { width: 1080, height: 1920 },
      true,
    );
    expect(rect.x).toBeCloseTo(10);
    expect(rect.y).toBeCloseTo(-80);
    expect(rect.width).toBeCloseTo(180);
    expect(rect.height).toBeCloseTo(320);
    expect(clip.top).toBeCloseTo(100);
    expect(clip.bottom).toBeCloseTo(100);
    expect(clip.left).toBeCloseTo(0);
    expect(clip.right).toBeCloseTo(0);
  });

  test("an uncropped thumbnail is its own box", () => {
    const box = { x: 1, y: 2, width: 30, height: 20 };
    expect(thumbStart(box, { width: 300, height: 200 }, false)).toEqual({
      rect: box,
      clip: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });
});

describe("mix", () => {
  test("moves every number the same share of the way", () => {
    const a = { x: 0, y: 100, width: 150, height: 100 };
    const b = { x: 0, y: 40, width: 390, height: 260 };
    expect(mix(a, b, 0.5)).toEqual({ x: 0, y: 70, width: 270, height: 180 });
    expect(mix(a, b, 0)).toEqual(a);
    expect(mix(a, b, 1)).toEqual(b);
  });
});

describe("zoomTarget", () => {
  test("up to three times the fit size", () => {
    expect(zoomTarget(1600, 400)).toBe(3);
  });

  test("never past the native width", () => {
    expect(zoomTarget(600, 400)).toBe(1.5);
  });

  test("no zoom below 1.2 or without a native width", () => {
    expect(zoomTarget(440, 400)).toBeNull();
    expect(zoomTarget(undefined, 400)).toBeNull();
  });
});

describe("zoomAt", () => {
  test("keeps the point under the finger", () => {
    const fitRect = { x: 0, y: 100, width: 400, height: 300 };
    const view = zoomAt(FIT_VIEW, fitRect, { x: 100, y: 250 }, 2);
    expect(view).toEqual({ scale: 2, x: -100, y: -150 });
    const r = viewRect(fitRect, view);
    expect(r.x + 100 * 2).toBe(100);
    expect(r.y + 150 * 2).toBe(250);
  });
});

describe("panBounds and clampView", () => {
  const fitRect = { x: 0, y: 100, width: 400, height: 300 };

  test("zoomed media must cover the viewport", () => {
    expect(panBounds(fitRect, 2, { width: 400, height: 500 })).toEqual({
      minX: -400,
      maxX: 0,
      minY: -200,
      maxY: -100,
    });
  });

  test("an axis smaller than the viewport stays centered", () => {
    expect(panBounds(fitRect, 1, { width: 400, height: 500 })).toEqual({
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    });
  });

  test("clampView keeps the scale and clamps the offsets", () => {
    const bounds = { minX: -400, maxX: 0, minY: -200, maxY: -100 };
    expect(clampView({ scale: 2, x: -500, y: 0 }, bounds)).toEqual({ scale: 2, x: -400, y: -100 });
  });
});
