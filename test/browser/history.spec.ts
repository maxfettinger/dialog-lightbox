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
  await expect(page.locator(".count")).toHaveText("2 / 7");
  await page.locator("[data-dlb-close]").click();
  await expect(page).toHaveURL(/\/test\/browser\/$/);
});

test("history: false leaves the URL alone", async ({ fixture: page }) => {
  await openAt(page, "three", 0);
  await expect(page.locator(".count")).toHaveText("1 / 1");
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

test("changing the hash to #dlb=<id> opens that slide on a page that is already open", async ({
  fixture: page,
}) => {
  await page.evaluate(() => {
    location.hash = "#dlb=one-2";
  });
  await expect(page.locator("dialog")).toHaveAttribute("open", "");
  await expect(page.locator(".count")).toHaveText("2 / 7");
  // The hash change was the navigation: back leaves the box and the hash.
  await page.goBack();
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page).not.toHaveURL(/#dlb=/);
});

test("changing the hash while the box is open moves to that slide, and a hash without #dlb= closes it", async ({
  fixture: page,
}) => {
  await openAt(page, "one", 0);
  await page.evaluate(() => {
    location.hash = "#dlb=one-2";
  });
  await expect(page.locator(".count")).toHaveText("2 / 7");
  await page.evaluate(() => {
    location.hash = "#top";
  });
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
});

test("a hash with an id that is not in the gallery does nothing", async ({ fixture: page }) => {
  await page.evaluate(() => {
    location.hash = "#dlb=nothing-here";
  });
  await page.waitForTimeout(300);
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
});

test("a hash change after the box has settled moves within it and keeps it open", async ({
  fixture: page,
}) => {
  await openAt(page, "one", 0);
  await page.waitForTimeout(400);
  for (const [hash, counter] of [
    ["#dlb=one-2", "2 / 7"],
    ["#dlb=one-5", "5 / 7"],
  ] as const) {
    await page.evaluate((h) => {
      location.hash = h;
    }, hash);
    await page.waitForTimeout(500);
    await expect(page.locator("dialog")).toHaveAttribute("open", "");
    await expect(page.locator(".count")).toHaveText(counter);
  }
});

test("closing after a hash change does not reopen the box", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    location.hash = "#dlb=one-2";
  });
  await expect(page.locator(".count")).toHaveText("2 / 7");
  await page.locator("[data-dlb-close]").click();
  await page.waitForTimeout(600);
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page).not.toHaveURL(/#dlb=/);
});

test("a #dlb= id of another gallery leaves the open box alone", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    location.hash = "#dlb=two-2";
  });
  await page.waitForTimeout(500);
  await expect(page.locator("dialog")).toHaveAttribute("open", "");
  await expect(page.locator(".count")).toHaveText("1 / 7");
});
