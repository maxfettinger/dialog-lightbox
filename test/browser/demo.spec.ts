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
  await expect(page.locator(".box-count")).toHaveText("2 / 2");
});

test("the API example opens the last photo and logs the events", async ({ page }) => {
  await page.goto("/examples/");
  await page.locator(".open-last").click();
  await expect(page.locator(".box-count")).toHaveText("3 / 3");
  await expect(page.locator(".log")).toContainText("open   slide 3 of 3");
});

test("code blocks are labelled and import the package by name", async ({ page }) => {
  await page.goto("/examples/");
  await expect(page.locator(".code figcaption span").first()).toHaveText("index.html");
  await expect(page.locator("#cropped .code pre").last()).toContainText('from "dialog-lightbox"');
});

test("on a wide screen the docs list their chapters beside the text and mark the one being read", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/docs/");
  const toc = page.locator(".toc");
  await expect(toc.locator("a")).toHaveCount(6);
  const [list, title] = [await toc.boundingBox(), await page.locator("h1").boundingBox()];
  expect(list!.x + list!.width).toBeLessThan(title!.x);
  await toc.locator('a[href="#javascript"]').click();
  await expect(toc.locator("a[aria-current]")).toHaveText("JavaScript");
  await expect(toc).toBeInViewport();
});

test("on a wide screen the examples list their sections beside the text and mark the one being read", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/examples/");
  const toc = page.locator(".toc");
  await expect(toc.locator("a")).toHaveCount(7);
  const [list, title] = [await toc.boundingBox(), await page.locator("h1").boundingBox()];
  expect(list!.x + list!.width).toBeLessThan(title!.x);
  await toc.locator('a[href="#video"]').click();
  await expect(toc.locator("a[aria-current]")).toHaveText("Video");
  await expect(toc).toBeInViewport();
});

test("a chapter link marks its chapter even when the page can't scroll its heading to the top", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/docs/");
  const toc = page.locator(".toc");
  await toc.locator('a[href="#good-to-know"]').click();
  await expect(toc.locator("a[aria-current]")).toHaveText("Good to know");
  await toc.locator('a[href="#gestures-and-keys"]').click();
  await expect(toc.locator("a[aria-current]")).toHaveText("Gestures and keys");
  // Scrolling by hand takes over again: at the bottom of the page the last chapter is marked.
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 5000);
  await expect(toc.locator("a[aria-current]")).toHaveText("Good to know");
});

test("the docs page has its tables and labelled code", async ({ page }) => {
  const errors = noErrors(page);
  await page.goto("/docs/");
  await expect(page.locator("table").first()).toBeVisible();
  await expect(page.locator(".code figcaption span").first()).toHaveText("index.html");
  expect(errors).toEqual([]);
});
