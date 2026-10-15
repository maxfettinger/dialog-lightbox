import { expect, openAt, test } from "./helpers";

test("next and previous move one slide and are disabled at the ends", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  const counter = page.locator("[data-dlb-counter]");
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
  await expect(page.locator("[data-dlb-counter]")).toHaveText("2 / 7");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 7");
});

test("the last slide stops there", async ({ fixture: page }) => {
  await openAt(page, "one", 6);
  await expect(page.locator("[data-dlb-next]")).toBeDisabled();
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-last", "");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("7 / 7");
});

test("a looping gallery wraps around", async ({ fixture: page }) => {
  await openAt(page, "two", 0);
  await expect(page.locator("[data-dlb-prev]")).toBeEnabled();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("3 / 3");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 3");
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
  await expect(page.locator("[data-dlb-counter]")).toHaveText("4 / 7");
  await expect(page.locator("[data-dlb-slide]")).toHaveCount(3);
});

test("goTo jumps to any slide", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.evaluate(() => window.boxes[0]!.goTo(4));
  await expect(page.locator("[data-dlb-counter]")).toHaveText("5 / 7");
  await expect(page.locator("[data-dlb-slide]")).toHaveCount(3);
});

test("a gallery with one slide can't move", async ({ fixture: page }) => {
  await openAt(page, "three", 0);
  await expect(page.locator("[data-dlb-prev]")).toBeDisabled();
  await expect(page.locator("[data-dlb-next]")).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 1");
});
