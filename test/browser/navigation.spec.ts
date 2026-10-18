import { expect, openAt, test } from "./helpers";

test("next and previous move one slide and are disabled at the ends", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  const counter = page.locator(".count");
  await expect(page.locator("[data-dlb-prev]")).toBeDisabled();
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-first", "");
  await page.locator("[data-dlb-next]").click();
  await expect(counter).toHaveText("2 / 7");
  await expect(page.locator("[data-dlb-prev]")).toBeEnabled();
  await page.locator("[data-dlb-prev]").click();
  await expect(counter).toHaveText("1 / 7");
  expect(await page.evaluate(() => window.log)).toEqual([
    "open:wide",
    "change:wide",
    "change:one-2",
    "change:wide",
  ]);
});

test("arrow keys move between slides", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".count")).toHaveText("2 / 7");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".count")).toHaveText("1 / 7");
});

test("the last slide stops there", async ({ fixture: page }) => {
  await openAt(page, "one", 6);
  await expect(page.locator("[data-dlb-next]")).toBeDisabled();
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-last", "");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".count")).toHaveText("7 / 7");
});

test("a looping gallery wraps around", async ({ fixture: page }) => {
  await openAt(page, "two", 0);
  await expect(page.locator("[data-dlb-prev]")).toBeEnabled();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".count")).toHaveText("3 / 3");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".count")).toHaveText("1 / 3");
});

test("two looping slides show the other one on both sides", async ({ fixture: page }) => {
  await page.evaluate(() => {
    const gallery = document.createElement("div");
    gallery.id = "pair";
    gallery.innerHTML =
      '<a href="media/square.svg"><img src="media/square-thumb.svg" alt="Square"></a>' +
      '<a href="media/tall.svg" data-dlb-width="600" data-dlb-height="900"><img src="media/tall-thumb.svg" alt="Tall"></a>';
    document.body.prepend(gallery);
    window.boxes.push(window.lightbox({ gallery, dialog: document.querySelector("dialog")!, loop: true }));
  });
  // Each neighbour's offset in the strip and its placeholder image, from left to right.
  const sides = (): Promise<[number, string][]> =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-dlb-slide]:not([data-dlb-current])")]
        .map((el): [number, string] => [
          Math.round(new DOMMatrix(el.style.transform).e),
          el.querySelector("img")!.src.split("/").pop()!,
        ])
        .sort((a, b) => a[0] - b[0]),
    );
  await openAt(page, "pair", 0);
  // The viewport is 390 wide and slides are 10 % of it apart.
  expect(await sides()).toEqual([
    [-429, "tall-thumb.svg"],
    [429, "tall-thumb.svg"],
  ]);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => page.evaluate(() => window.boxes.at(-1)!.current?.index)).toBe(1);
  expect(await sides()).toEqual([
    [-429, "square-thumb.svg"],
    [429, "square-thumb.svg"],
  ]);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => page.evaluate(() => window.boxes.at(-1)!.current?.index)).toBe(1);
  await expect(page.locator("[data-dlb-slide]")).toHaveCount(3);
});

test("only the current slide is exposed to screen readers", async ({ fixture: page }) => {
  await openAt(page, "one", 1);
  await expect(page.locator("[data-dlb-slide]")).toHaveCount(3);
  await expect(page.locator("[data-dlb-slide][aria-hidden='false']")).toHaveCount(1);
  await expect(page.locator("[data-dlb-current]")).toHaveAttribute("aria-hidden", "false");
});

test("fast key presses land on the right slide with three slide elements at most", async ({
  fixture: page,
}) => {
  await openAt(page, "one", 0);
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator(".count")).toHaveText("4 / 7");
  await expect(page.locator("[data-dlb-slide]")).toHaveCount(3);
});

test("goTo jumps to any slide", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.evaluate(() => window.boxes[0]!.goTo(4));
  await expect(page.locator(".count")).toHaveText("5 / 7");
  await expect(page.locator("[data-dlb-slide]")).toHaveCount(3);
});

test("a gallery with one slide can't move", async ({ fixture: page }) => {
  await openAt(page, "three", 0);
  await expect(page.locator("[data-dlb-prev]")).toBeDisabled();
  await expect(page.locator("[data-dlb-next]")).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".count")).toHaveText("1 / 1");
});

test("arrow keys with a modifier are left to the browser", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  for (const key of ["Alt+ArrowRight", "Meta+ArrowRight", "Control+ArrowRight"])
    await page.keyboard.press(key);
  await page.waitForTimeout(400);
  await expect(page.locator(".count")).toHaveText("1 / 7");
});

test("arrow keys still work after an overlay button on the previous slide had focus", async ({
  fixture: page,
}) => {
  await page.evaluate(() => {
    const template = document.createElement("template");
    template.setAttribute("data-dlb-overlay", "video");
    template.innerHTML = '<button type="button" class="ov-play" data-dlb-play>Play</button>';
    document.querySelector("dialog")!.append(template);
  });
  await openAt(page, "one", 3);
  await page.locator("[data-dlb-current] .ov-play").click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".count")).toHaveText("5 / 7");
  await page.waitForTimeout(400);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".count")).toHaveText("6 / 7");
});

test("arrow keys still work after the video was fullscreen", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  await page.locator("[data-dlb-fullscreen]").click();
  await page.waitForFunction(() => document.fullscreenElement !== null);
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => document.fullscreenElement === null);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".count")).toHaveText("5 / 7");
});
