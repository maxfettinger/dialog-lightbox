import { expect, openAt, test } from "./helpers";

test("opening adds #dlb=<id>, slide changes replace it, and back closes", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await expect(page).toHaveURL(/#dlb=wide$/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#dlb=one-2$/);
  await page.goBack();
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page).not.toHaveURL(/#dlb=/);
});

test("closing with the button removes the hash again", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.locator("[data-dlb-close]").click();
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page).not.toHaveURL(/#dlb=/);
});

test("a URL with #dlb=<id> opens that slide", async ({ page }) => {
  await page.goto("/test/browser/#dlb=one-2");
  await expect(page.locator("dialog")).toHaveAttribute("open", "");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("2 / 7");
  await page.locator("[data-dlb-close]").click();
  await expect(page).toHaveURL(/\/test\/browser\/$/);
});

test("history: false leaves the URL alone", async ({ fixture: page }) => {
  await openAt(page, "three", 0);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 1");
  await expect(page).not.toHaveURL(/#dlb=/);
});

test("hovering a thumbnail with the mouse starts loading its large image", async ({ fixture: page }) => {
  const request = page.waitForRequest(/media\/tall\.svg$/);
  await page.locator("#one a").nth(1).hover();
  await request;
});

test("a malformed #dlb= hash is ignored instead of breaking the page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/test/browser/#dlb=%E0%A4%A");
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  expect(await page.evaluate(() => window.boxes.length)).toBe(4);
  expect(errors).toEqual([]);
});

test("closing leaves the URL alone when the page navigated away from the hash", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.evaluate(() => {
    history.pushState(null, "", "?route=project");
    window.boxes[0]!.destroy();
  });
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\?route=project$/);
});
