import type { Page } from "@playwright/test";
import { expect, openAt, test } from "./helpers";

/** Adds an overlay template to the dialog, as a page would write it. */
const addTemplate = (page: Page, type: string | null, html: string): Promise<void> =>
  page.evaluate(
    ([type, html]) => {
      const template = document.createElement("template");
      template.setAttribute("data-dlb-overlay", type ?? "");
      template.innerHTML = html;
      document.querySelector("dialog")!.append(template);
    },
    [type, html] as const,
  );

const VIDEO_OVERLAY =
  '<button type="button" class="ov-play" data-dlb-play>Play</button><i class="ov-bar" data-dlb-progress></i>';

test("a video overlay is copied into each video slide's media and into no photo", async ({
  fixture: page,
}) => {
  await addTemplate(page, "video", VIDEO_OVERLAY);
  // Slide 4 is a video between a photo (3) and another video (5).
  await openAt(page, "one", 3);
  await expect(page.locator("[data-dlb-current] [data-dlb-overlay]")).toHaveCount(1);
  await expect(page.locator("[data-dlb-slide] [data-dlb-overlay]")).toHaveCount(2);
  const [media, overlay] = await Promise.all([
    page.locator("[data-dlb-current] > div").boundingBox(),
    page.locator("[data-dlb-current] [data-dlb-overlay]").boundingBox(),
  ]);
  expect(overlay).toEqual(media);
});

test("a template without a type goes on every slide", async ({ fixture: page }) => {
  await addTemplate(page, null, '<span class="ov-all">All</span>');
  await openAt(page, "one", 3);
  await expect(page.locator("[data-dlb-slide] .ov-all")).toHaveCount(3);
});

test("one template per type can sit side by side", async ({ fixture: page }) => {
  await addTemplate(page, "image", '<span class="ov-photo">Photo</span>');
  await addTemplate(page, "video", VIDEO_OVERLAY);
  await openAt(page, "one", 2);
  await expect(page.locator("[data-dlb-current] .ov-photo")).toHaveCount(1);
  await expect(page.locator("[data-dlb-slide] .ov-play")).toHaveCount(1);
});

test("the overlay's play button pauses once, without hiding the controls", async ({ fixture: page }) => {
  await addTemplate(page, "video", VIDEO_OVERLAY);
  await openAt(page, "one", 3);
  const dialog = page.locator("dialog");
  const play = page.locator("[data-dlb-current] .ov-play");
  await expect(dialog).not.toHaveAttribute("data-dlb-paused");
  await play.click();
  await expect(dialog).toHaveAttribute("data-dlb-paused", "");
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(dialog).not.toHaveAttribute("data-dlb-ui-hidden");
  await play.click();
  await expect(dialog).not.toHaveAttribute("data-dlb-paused");
});

test("the overlay's progress bar follows the video", async ({ fixture: page }) => {
  await addTemplate(page, "video", VIDEO_OVERLAY);
  await openAt(page, "one", 3);
  await page.waitForFunction(() => {
    const bar = document.querySelector<HTMLElement>("[data-dlb-current] .ov-bar");
    return bar !== null && Number(bar.style.getPropertyValue("--dlb-progress")) > 0;
  });
});

test("slides that aren't current are inert", async ({ fixture: page }) => {
  await addTemplate(page, "video", VIDEO_OVERLAY);
  await openAt(page, "one", 3);
  await expect(page.locator("[data-dlb-slide]:not([data-dlb-current])")).toHaveCount(2);
  for (const slide of await page.locator("[data-dlb-slide]:not([data-dlb-current])").all())
    expect(await slide.evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  expect(await page.locator("[data-dlb-current]").evaluate((el) => (el as HTMLElement).inert)).toBe(false);
});

test("the overlay hides while a photo is zoomed", async ({ fixture: page }) => {
  await addTemplate(page, "image", '<span class="ov-photo">Photo</span>');
  await openAt(page, "one", 0);
  const overlay = page.locator("[data-dlb-current] [data-dlb-overlay]");
  await expect(overlay).toHaveCSS("opacity", "1");
  await page.locator("[data-dlb-zoom]").click();
  await expect(overlay).toHaveCSS("opacity", "0");
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the dialog has data-dlb-animating during the opening and closing zoom", async ({ fixture: page }) => {
    await addTemplate(page, "image", '<span class="ov-photo">Photo</span>');
    const during = await page.evaluate(() => {
      document.querySelector<HTMLAnchorElement>("#one a")!.click();
      return document.querySelector("dialog")!.hasAttribute("data-dlb-animating");
    });
    expect(during).toBe(true);
    const dialog = page.locator("dialog");
    await expect(dialog).not.toHaveAttribute("data-dlb-animating");
    await expect(page.locator("[data-dlb-current] [data-dlb-overlay]")).toHaveCSS("opacity", "1");
    const closing = await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>("[data-dlb-close]")!.click();
      return document.querySelector("dialog")!.hasAttribute("data-dlb-animating");
    });
    expect(closing).toBe(true);
  });
});
