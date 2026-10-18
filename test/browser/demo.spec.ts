import { expect, test } from "@playwright/test";

// The demo site as Hugo builds it: every page loads without errors, the examples open, and their code is shown.
for (const [path, gallery] of [
  ["/", ".try-gallery"],
  ["/examples/minimal/", ".gallery"],
  ["/examples/basic/", ".gallery"],
  ["/examples/film/", ".film"],
] as const) {
  test(`demo page ${path} works`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(path);
    await page.locator(`${gallery} a`).first().click();
    await expect(page.locator("dialog")).toHaveAttribute("open", "");
    expect(errors).toEqual([]);
  });
}

test("the docs page has its tables and highlighted code", async ({ page }) => {
  await page.goto("/docs/");
  await expect(page.locator("table").first()).toBeVisible();
  await expect(page.locator("pre.chroma").first()).toBeVisible();
});

test("the example code loads the released files from jsDelivr", async ({ page }) => {
  await page.goto("/examples/basic/");
  await expect(page.locator("pre.chroma").last()).toContainText(
    "https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/dialog-lightbox.js",
  );
});
