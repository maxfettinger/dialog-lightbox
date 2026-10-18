import { expect, test } from "@playwright/test";

// The demo site: every page loads without errors, the examples open, and their code is shown.
for (const [path, gallery] of [
  ["/demo/", ".try"],
  ["/demo/examples/minimal.html", ".gallery"],
  ["/demo/examples/basic.html", ".gallery"],
  ["/demo/examples/film.html", ".film"],
] as const) {
  test(`demo page ${path} works`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(path);
    for (const code of await page.locator("[data-source]").all()) await expect(code).not.toBeEmpty();
    await page.locator(`${gallery} a`).first().click();
    await expect(page.locator("dialog")).toHaveAttribute("open", "");
    expect(errors).toEqual([]);
  });
}

test("the example code points at the released files on jsDelivr", async ({ page }) => {
  await page.goto("/demo/examples/basic.html");
  await expect(page.locator('[data-source="js"]')).toContainText(
    "https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/dialog-lightbox.js",
  );
});
