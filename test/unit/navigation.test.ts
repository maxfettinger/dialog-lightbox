import { describe, expect, test } from "bun:test";
import { neighbours, step } from "../../src/core/navigation";

describe("step", () => {
  test("moves inside the gallery", () => {
    expect(step(1, 1, 3, false)).toBe(2);
    expect(step(1, -1, 3, false)).toBe(0);
  });

  test("stops at the ends without loop", () => {
    expect(step(2, 1, 3, false)).toBeNull();
    expect(step(0, -1, 3, false)).toBeNull();
  });

  test("wraps around with loop", () => {
    expect(step(2, 1, 3, true)).toBe(0);
    expect(step(0, -1, 3, true)).toBe(2);
  });

  test("a single slide never moves, even with loop", () => {
    expect(step(0, 1, 1, true)).toBeNull();
    expect(step(0, -1, 1, true)).toBeNull();
  });

  test("an empty gallery has nowhere to go", () => {
    expect(step(0, 1, 0, true)).toBeNull();
  });
});

describe("neighbours", () => {
  test("previous, current and next", () => {
    expect(neighbours(1, 3, false)).toEqual([0, 1, 2]);
  });

  test("nothing past the ends", () => {
    expect(neighbours(0, 1, false)).toEqual([null, 0, null]);
    expect(neighbours(2, 3, false)).toEqual([1, 2, null]);
  });

  test("two looping slides: the other one appears once, as next", () => {
    expect(neighbours(0, 2, true)).toEqual([null, 0, 1]);
  });
});
