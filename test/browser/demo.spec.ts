import { expect, type Page, test } from "@playwright/test";

// The demo site as Hugo builds it with the Vitrine theme (the web server builds it first). Every page loads without
// errors, every example's gallery opens in the shared dialog, and the code below an example is the code that runs.

const noErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

test("the start page's gallery opens", async ({ page }) => {
  const errors = noErrors(page);
  await page.goto("/");
  await page.locator(".try a").first().click();
  await expect(page.locator("dialog.box")).toHaveAttribute("open", "");
  expect(errors).toEqual([]);
});

const examples = {
  cropped: "frames",
  zoom: "large",
  captions: "captioned",
  video: "clips",
  deeplinks: "linked",
  api: "controlled",
};

for (const [example, gallery] of Object.entries(examples)) {
  test(`the ${example} example opens`, async ({ page }) => {
    const errors = noErrors(page);
    await page.goto(`/examples/${example}/`);
    await page.locator(`#${gallery} a`).first().click();
    await expect(page.locator("dialog.box")).toHaveAttribute("open", "");
    expect(errors).toEqual([]);
  });
}

test("the captions example writes the figure's caption", async ({ page }) => {
  await page.goto("/examples/captions/");
  await page.locator("#captioned a").first().click();
  await expect(page.locator(".box-caption")).toHaveText(/thin line/);
});

test("a #dlb= link in the text opens its slide", async ({ page }) => {
  await page.goto("/examples/deeplinks/");
  await page.locator('a[href="#dlb=amber"]').click();
  await expect(page.locator("dialog.box")).toHaveAttribute("open", "");
  await expect(page.locator(".box-count")).toHaveText("2 / 2");
});

test("the API example opens the last photo and logs the events", async ({ page }) => {
  await page.goto("/examples/api/");
  await page.locator(".open-last").click();
  await expect(page.locator(".box-count")).toHaveText("3 / 3");
  await expect(page.locator(".log")).toContainText("open   slide 3 of 3");
});

test("an example's code is labelled and imports the package by name", async ({ page }) => {
  await page.goto("/examples/cropped/");
  await expect(page.locator(".code figcaption span").first()).toHaveText("example.html");
  await expect(page.locator(".example .code pre").last()).toContainText('from "dialog-lightbox"');
});

test("the docs have their tables and labelled code", async ({ page }) => {
  const errors = noErrors(page);
  await page.goto("/docs/guide/dialog/");
  await expect(page.locator("table").first()).toBeVisible();
  await expect(page.locator(".code figcaption span").first()).toHaveText("index.html");
  expect(errors).toEqual([]);
});
