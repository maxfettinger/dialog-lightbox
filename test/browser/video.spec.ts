import { expect, openAt, test } from "./helpers";

test("a video slide plays muted, looped and without native controls", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  const dialog = page.locator("dialog");
  const video = page.locator("[data-dlb-current] video");
  await expect(video).toHaveCount(1);
  await expect(dialog).toHaveAttribute("data-dlb-type", "video");
  await expect(dialog).not.toHaveAttribute("data-dlb-paused");
  await expect(dialog).toHaveAttribute("data-dlb-muted", "");
  await expect(page.locator("[data-dlb-play]")).toHaveAttribute("aria-pressed", "true");
  const element = await video.evaluate((v: HTMLVideoElement) => ({
    muted: v.muted,
    controls: v.controls,
    loop: v.loop,
    inline: v.playsInline,
  }));
  expect(element).toEqual({ muted: true, controls: false, loop: true, inline: true });
  // Revealed over the poster once a frame is painted.
  await expect(video).toHaveCSS("opacity", "1");
});

test("the play button and Space pause and resume", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  const dialog = page.locator("dialog");
  await expect(dialog).not.toHaveAttribute("data-dlb-paused");
  await page.locator("[data-dlb-play]").click();
  await expect(dialog).toHaveAttribute("data-dlb-paused", "");
  await page.locator("[data-dlb-viewport]").focus();
  await page.keyboard.press(" ");
  await expect(dialog).not.toHaveAttribute("data-dlb-paused");
});

test("the mute button and M turn the sound on and off", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  const mute = page.locator("[data-dlb-mute]");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  expect(await page.locator("[data-dlb-current] video").evaluate((v: HTMLVideoElement) => v.muted)).toBe(
    false,
  );
  await page.locator("[data-dlb-viewport]").focus();
  await page.keyboard.press("m");
  await expect(mute).toHaveAttribute("aria-pressed", "true");
});

test("sound stays on for the next video", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  await page.locator("[data-dlb-mute]").click();
  await page.locator("[data-dlb-next]").click();
  await expect(page.locator("[data-dlb-counter]")).toHaveText("5 / 7");
  expect(await page.locator("[data-dlb-current] video").evaluate((v: HTMLVideoElement) => v.muted)).toBe(
    false,
  );
});

test("a clip without audio disables the mute button", async ({ fixture: page }) => {
  await openAt(page, "one", 5);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-noaudio", "");
  await expect(page.locator("[data-dlb-mute]")).toBeDisabled();
});

test("leaving the video releases it", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  await expect(page.locator("[data-dlb-current] video")).toHaveCount(1);
  await page.locator("[data-dlb-prev]").click();
  await expect(page.locator("[data-dlb-counter]")).toHaveText("3 / 7");
  await expect(page.locator("video")).toHaveCount(0);
  expect(await page.evaluate(() => window.boxes[0]!.video.hasAttribute("src"))).toBe(false);
});

test("the progress element follows the playback", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  const progress = page.locator("[data-dlb-progress]");
  await expect
    .poll(() =>
      progress.evaluate(
        (el) => Number.parseFloat(getComputedStyle(el).getPropertyValue("--dlb-progress")) || 0,
      ),
    )
    .toBeGreaterThan(0);
});

test("closing releases the video", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page.locator("video")).toHaveCount(0);
});
