import type { Page } from "@playwright/test";
import { expect, openAt, test } from "./helpers";

test.use({ reducedMotion: "no-preference" });

/** Waits until the current slide's media have no running animation. */
const settled = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => {
    const media = document.querySelector("[data-dlb-current] > div");
    return media !== null && media.getAnimations().length === 0;
  });

test("opening zooms out of the thumbnail, which stays visible", async ({ fixture: page }) => {
  const state = await page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>("#one a")!;
    link.click();
    const media = document.querySelector("[data-dlb-current] > div")!;
    const effect = media.getAnimations()[0]?.effect;
    const keyframes = effect instanceof KeyframeEffect ? effect.getKeyframes() : [];
    return {
      animations: media.getAnimations().length,
      clipStart: String(keyframes[0]?.clipPath ?? ""),
      thumb: getComputedStyle(link.querySelector("img")!).visibility,
    };
  });
  expect(state.animations).toBe(1);
  // wide-thumb.svg is 4:1 in a 3:2 box with object-fit: cover, so the zoom starts clipped at the sides.
  expect(state.clipStart).toMatch(/^inset\(0px [1-9]/);
  expect(state.thumb).toBe("visible");
  await settled(page);
  await expect(page.locator("#one a img").first()).toHaveCSS("visibility", "visible");
});

/**
 * Pauses the current media's animation at a share of its time and returns how far each edge of the visible
 * frame (the media clipped to their clip-path) has moved from its first frame towards its last.
 */
const progressAt = (page: Page, share: number): Promise<number[]> =>
  page.evaluate((share) => {
    const media = document.querySelector<HTMLElement>("[data-dlb-current] > div")!;
    const animation = media.getAnimations()[0]!;
    const duration = Number(animation.effect!.getTiming().duration);
    const visible = (): number[] => {
      const style = getComputedStyle(media);
      const m = new DOMMatrix(style.transform);
      const inset = (/inset\(([^)]*)\)/.exec(style.clipPath)?.[1] ?? "0px").split(" ").map(Number.parseFloat);
      const [t = 0, r = t, b = t, l = r] = inset;
      const width = Number.parseFloat(style.width);
      const height = Number.parseFloat(style.height);
      return [m.e + l * m.a, m.f + t * m.a, m.e + (width - r) * m.a, m.f + (height - b) * m.a];
    };
    animation.pause();
    animation.currentTime = 0;
    const start = visible();
    animation.currentTime = duration;
    const end = visible();
    animation.currentTime = duration * share;
    const now = visible();
    return now.map((value, i) => (value - start[i]!) / (end[i]! - start[i]!));
  }, share);

test("opening grows the visible frame in a straight line from the thumbnail to the photo", async ({
  fixture: page,
}) => {
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>("#one a")!.click());
  for (const share of [0.25, 0.5, 0.75]) {
    const edges = await progressAt(page, share);
    // Every edge has come the same part of the way.
    for (const edge of edges) expect(edge).toBeCloseTo(edges[0]!, 2);
    expect(edges[0]).toBeGreaterThan(0);
    expect(edges[0]).toBeLessThan(1);
  }
});

test("closing shrinks the visible frame in a straight line to the thumbnail", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await settled(page);
  await page.keyboard.press("Escape");
  for (const share of [0.25, 0.5, 0.75]) {
    const edges = await progressAt(page, share);
    for (const edge of edges) expect(edge).toBeCloseTo(edges[0]!, 2);
    expect(edges[0]).toBeGreaterThan(0);
    expect(edges[0]).toBeLessThan(1);
  }
});

test("after opening the backdrop is fully opaque", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await settled(page);
  const opacity = await page.evaluate(() =>
    getComputedStyle(document.querySelector("dialog")!).getPropertyValue("--dlb-opacity").trim(),
  );
  expect(opacity).toBe("1");
});

test("with reduced motion nothing animates", async ({ fixture: page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const animations = await page.evaluate(() => {
    document.querySelector<HTMLAnchorElement>("#one a")!.click();
    return document.querySelector("[data-dlb-current] > div")!.getAnimations().length;
  });
  expect(animations).toBe(0);
});

test("closing scrolls the current thumbnail into view first", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await settled(page);
  await page.evaluate(() => window.boxes[0]!.goTo(6));
  await expect(page.locator(".count")).toHaveText("7 / 7");
  const link = page.locator("#one a").nth(6);
  expect((await link.boundingBox())!.x).toBeGreaterThan(390);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  const box = (await link.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(link.locator("img")).toHaveCSS("visibility", "visible");
});
