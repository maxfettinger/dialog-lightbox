import { expect, openAt, test } from "./helpers";

test("the zoom button zooms to three times the fit size and back", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  const dialog = page.locator("dialog");
  const zoom = page.locator("[data-dlb-zoom]");
  const media = page.locator("[data-dlb-current] > div");
  await expect(dialog).toHaveAttribute("data-dlb-zoomable", "");
  await zoom.click();
  await expect(dialog).toHaveAttribute("data-dlb-zoomed", "");
  await expect(zoom).toHaveAttribute("aria-pressed", "true");
  // Re-rendered at the zoomed size for sharp pixels: 3 × 390 px.
  await expect(media).toHaveCSS("width", "1170px");
  await zoom.click();
  await expect(dialog).not.toHaveAttribute("data-dlb-zoomed");
  await expect(zoom).toHaveAttribute("aria-pressed", "false");
  await expect(media).toHaveCSS("width", "390px");
});

test("a photo too small to zoom disables the zoom button", async ({ fixture: page }) => {
  await openAt(page, "one", 2);
  await expect(page.locator("[data-dlb-zoom]")).toBeDisabled();
  await expect(page.locator("dialog")).not.toHaveAttribute("data-dlb-zoomable");
});

test("without a known native width a photo becomes zoomable once loaded", async ({ fixture: page }) => {
  await openAt(page, "three", 0);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-zoomable", "");
});

test("resizing the window resets the zoom", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.locator("[data-dlb-zoom]").click();
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-zoomed", "");
  await page.setViewportSize({ width: 600, height: 844 });
  await expect(page.locator("dialog")).not.toHaveAttribute("data-dlb-zoomed");
});

test("zooming right after opening isn't undone by the first resize observation", async ({
  fixture: page,
}) => {
  await page.evaluate(() => {
    document.querySelector<HTMLAnchorElement>("#one a")!.click();
    document.querySelector<HTMLButtonElement>("[data-dlb-zoom]")!.click();
  });
  await page.waitForTimeout(200);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-zoomed", "");
});
