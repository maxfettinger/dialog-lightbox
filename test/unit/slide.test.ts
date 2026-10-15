import { describe, expect, test } from "bun:test";
import { largestWidth, resolveSize, slideId } from "../../src/core/slide";

describe("largestWidth", () => {
  test("the largest w descriptor, in any order", () => {
    expect(largestWidth("a.webp 1080w, b.webp 1600w")).toBe(1600);
    expect(largestWidth("b.webp 1600w,a.webp 1080w")).toBe(1600);
  });

  test("nothing without w descriptors", () => {
    expect(largestWidth("a.webp 2x")).toBeUndefined();
    expect(largestWidth("a.webp")).toBeUndefined();
    expect(largestWidth(undefined)).toBeUndefined();
  });
});

describe("resolveSize", () => {
  test("width and height attributes win", () => {
    expect(resolveSize(1600, 1067, { width: 480, height: 320 }, "a.webp 1080w")).toEqual({
      aspect: { width: 1600, height: 1067 },
      native: 1600,
    });
  });

  test("otherwise the thumbnail's aspect ratio and the srcset's largest width", () => {
    expect(resolveSize(Number.NaN, Number.NaN, { width: 300, height: 450 }, "a.webp 600w")).toEqual({
      aspect: { width: 300, height: 450 },
      native: 600,
    });
  });

  test("unknown until the image loads when nothing tells", () => {
    expect(resolveSize(Number.NaN, Number.NaN, null, undefined)).toEqual({ aspect: null, native: undefined });
    expect(resolveSize(Number.NaN, Number.NaN, { width: 0, height: 0 }, undefined)).toEqual({
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
