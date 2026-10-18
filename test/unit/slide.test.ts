import { describe, expect, test } from "bun:test";
import { resolveSize, slideId } from "../../src/core/slide";

describe("resolveSize", () => {
  test("width and height attributes win", () => {
    expect(resolveSize(1600, 1067, { width: 480, height: 320 })).toEqual({
      aspect: { width: 1600, height: 1067 },
      native: 1600,
    });
  });

  test("otherwise the thumbnail's aspect ratio, and the native width once the image loads", () => {
    expect(resolveSize(Number.NaN, Number.NaN, { width: 300, height: 450 })).toEqual({
      aspect: { width: 300, height: 450 },
      native: undefined,
    });
  });

  test("unknown until the image loads when nothing tells", () => {
    expect(resolveSize(Number.NaN, Number.NaN, null)).toEqual({ aspect: null, native: undefined });
    expect(resolveSize(Number.NaN, Number.NaN, { width: 0, height: 0 })).toEqual({
      aspect: null,
      native: undefined,
    });
  });
});

describe("slideId", () => {
  test("data-dlb-id, or the gallery id and the slide's number", () => {
    expect(slideId("ferry", "one", 0)).toBe("ferry");
    expect(slideId(undefined, "one", 1)).toBe("one-2");
    expect(slideId("", "g1", 0)).toBe("g1-1");
  });
});
