import { expect, type Page, test } from "@playwright/test";

// The demo site as Hugo builds it (the web server builds it first). Every page loads without errors, every
// example's gallery opens in the shared dialog, and the code blocks carry their file names.

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

for (const gallery of ["frames", "large", "captioned", "clips", "norway", "controlled"]) {
  test(`the ${gallery} example opens`, async ({ page }) => {
    const errors = noErrors(page);
    await page.goto("/examples/");
    await page.locator(`#${gallery} a`).first().click();
    await expect(page.locator("dialog.box")).toHaveAttribute("open", "");
    expect(errors).toEqual([]);
  });
}

test("the captions example writes the figure's caption", async ({ page }) => {
  await page.goto("/examples/");
  await page.locator("#captioned a").first().click();
  await expect(page.locator(".box-caption")).toHaveText(/Bodø/);
});

test("a #dlb= link in the text opens its slide", async ({ page }) => {
  await page.goto("/examples/");
  await page.locator('a[href="#dlb=north-cape"]').click();
  await expect(page.locator("dialog.box")).toHaveAttribute("open", "");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("2 / 2");
});

test("the API example opens the last photo and logs the events", async ({ page }) => {
  await page.goto("/examples/");
  await page.locator(".open-last").click();
  await expect(page.locator("[data-dlb-counter]")).toHaveText("3 / 3");
  await expect(page.locator(".log")).toContainText("open   slide 3 of 3");
});

test("code blocks are labelled and import the package by name", async ({ page }) => {
  await page.goto("/examples/");
  await expect(page.locator(".code figcaption span").first()).toHaveText("index.html");
  await expect(page.locator("#cropped .code pre").last()).toContainText('from "dialog-lightbox"');
});

test("the docs page has its tables and labelled code", async ({ page }) => {
  const errors = noErrors(page);
  await page.goto("/docs/");
  await expect(page.locator("table").first()).toBeVisible();
  await expect(page.locator(".code figcaption span").first()).toHaveText("index.html");
  expect(errors).toEqual([]);
});
