import type { Page } from "@playwright/test";
import { expect, openAt, test } from "./helpers";

test.use({ reducedMotion: "no-preference" });

/** Waits until the current slide's media have no running animation. */
const settled = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => {
    const media = document.querySelector("[data-dlb-current] > div");
    return media !== null && media.getAnimations().length === 0;
  });

test("opening zooms out of the thumbnail, which hides meanwhile", async ({ fixture: page }) => {
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
  expect(state.thumb).toBe("hidden");
  await settled(page);
  await expect(page.locator("#one a img").first()).toHaveCSS("visibility", "visible");
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
  await expect(page.locator("[data-dlb-counter]")).toHaveText("7 / 7");
  const link = page.locator("#one a").nth(6);
  expect((await link.boundingBox())!.x).toBeGreaterThan(390);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  const box = (await link.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(link.locator("img")).toHaveCSS("visibility", "visible");
});
