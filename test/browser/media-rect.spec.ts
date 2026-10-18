import type { Page } from "@playwright/test";
import { drag, expect, openAt, test } from "./helpers";

/** The rectangle the dialog reports in --dlb-media-*, and the current media's box on screen. */
const rects = (page: Page) =>
  page.evaluate(() => {
    const dialog = document.querySelector("dialog")!;
    const style = getComputedStyle(dialog);
    const px = (name: string): number => Number.parseFloat(style.getPropertyValue(`--dlb-media-${name}`));
    const box = document.querySelector("[data-dlb-current] > div")!.getBoundingClientRect();
    const viewport = document.querySelector("[data-dlb-viewport]")!.getBoundingClientRect();
    return {
      reported: [px("x"), px("y"), px("width"), px("height")].map(Math.round),
      actual: [box.left - viewport.left, box.top - viewport.top, box.width, box.height].map(Math.round),
    };
  });

test("the dialog reports the current media's rectangle", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await expect(page.locator("dialog")).not.toHaveAttribute("data-dlb-moving");
  const { reported, actual } = await rects(page);
  expect(reported).toEqual(actual);
});

test("the rectangle follows a zoom and a slide change", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.locator("[data-dlb-zoom]").click();
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-zoomed", "");
  let { reported, actual } = await rects(page);
  expect(reported).toEqual(actual);
  expect(reported[2]).toBe(1170);
  await page.locator("[data-dlb-zoom]").click();
  await drag(page, [300, 400], [60, 400]);
  await expect(page.locator(".count")).toHaveText("2 / 7");
  ({ reported, actual } = await rects(page));
  expect(reported).toEqual(actual);
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the dialog has data-dlb-moving until the media have settled", async ({ fixture: page }) => {
    const during = await page.evaluate(() => {
      document.querySelector<HTMLAnchorElement>("#one a")!.click();
      return document.querySelector("dialog")!.hasAttribute("data-dlb-moving");
    });
    expect(during).toBe(true);
    await expect(page.locator("dialog")).not.toHaveAttribute("data-dlb-moving");
    const { reported, actual } = await rects(page);
    expect(reported).toEqual(actual);
  });
});
