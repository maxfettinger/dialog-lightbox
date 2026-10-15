import { expect, openAt, test } from "./helpers";

test("a click on a thumbnail opens its slide", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-type", "image");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 7");
  expect(await page.evaluate(() => window.log)).toEqual(["open:wide", "change:wide"]);
});

test("the thumbnail shows at once and the large image lies over it once decoded", async ({
  fixture: page,
}) => {
  await openAt(page, "one", 0);
  const images = page.locator("[data-dlb-current] img");
  await expect(images).toHaveCount(2);
  await expect(images.last()).toHaveAttribute("src", /media\/wide\.svg$/);
  await expect(images.last()).toHaveAttribute("alt", "Wide");
  await expect(page.locator("dialog")).not.toHaveAttribute("data-dlb-loading");
});

test("the photo fits inside the viewport's padding", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  // wide.svg is 3200 × 800; the viewport is 390 × 844 with 40 px padding above and 60 px below.
  const box = await page.locator("[data-dlb-current] > div").boundingBox();
  expect(box?.width).toBeCloseTo(390, 0);
  expect(box?.height).toBeCloseTo(97.5, 0);
  expect(box?.y).toBeCloseTo(40 + (744 - 97.5) / 2, 0);
});

test("without width and height the size comes from the thumbnail", async ({ fixture: page }) => {
  await openAt(page, "one", 1);
  // tall-thumb.svg is 300 × 450: 390 wide fits, which makes it 585 high.
  const box = await page.locator("[data-dlb-current] > div").boundingBox();
  expect(box?.width).toBeCloseTo(390, 0);
  expect(box?.height).toBeCloseTo(585, 0);
});

test("a link without a thumbnail opens once its image has loaded", async ({ fixture: page }) => {
  await openAt(page, "three", 0);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 1");
  const media = page.locator("[data-dlb-current] > div");
  await expect(media).toBeVisible();
  // square.svg is 1000 × 1000 and fits 390 wide.
  expect((await media.boundingBox())?.width).toBeCloseTo(390, 0);
});

test("the close button closes and focus returns to the thumbnail", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.locator("[data-dlb-close]").click();
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page.locator("#one a").first()).toBeFocused();
  await expect(page.locator("[data-dlb-viewport] > *")).toHaveCount(0);
  expect(await page.evaluate(() => window.log)).toEqual(["open:wide", "change:wide", "close:wide"]);
});

test("Escape closes", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
});

test("closing right after opening leaves nothing behind", async ({ fixture: page }) => {
  await page.evaluate(() => {
    document.querySelector<HTMLAnchorElement>("#one a")!.click();
    window.boxes[0]!.close();
  });
  await page.waitForTimeout(300);
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page.locator("[data-dlb-viewport] > *")).toHaveCount(0);
  const names = await page.evaluate(() => document.querySelector("dialog")!.getAttributeNames());
  expect(names.filter((name) => name.startsWith("data-dlb-"))).toEqual([]);
});

test("clicks with a modifier key are left to the browser", async ({ fixture: page }) => {
  const prevented = await page.evaluate(() => {
    let result = true;
    document.addEventListener(
      "click",
      (event) => {
        result = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true });
    document.querySelector("#one a")!.dispatchEvent(click);
    return result;
  });
  expect(prevented).toBe(false);
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
});

test("a broken large image shows the error state and keeps the thumbnail", async ({ fixture: page }) => {
  await openAt(page, "one", 6);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-error", "");
  await expect(page.locator("[data-dlb-current] img")).toHaveCount(1);
});

test("lightbox() needs a viewport in the dialog", async ({ fixture: page }) => {
  const message = await page.evaluate(() => {
    try {
      window.lightbox({ gallery: document.body, dialog: document.createElement("dialog") });
      return "";
    } catch (error) {
      return (error as Error).message;
    }
  });
  expect(message).toContain("[data-dlb-viewport]");
});

test("destroy() closes an open box and stops opening on clicks", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.evaluate(() => window.boxes[0]!.destroy());
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page.locator("[data-dlb-viewport] > *")).toHaveCount(0);
  const opened = await page.evaluate(() => {
    document.addEventListener("click", (event) => event.preventDefault(), { once: true });
    document.querySelector<HTMLAnchorElement>("#one a")!.click();
    return document.querySelector("dialog")!.hasAttribute("open");
  });
  expect(opened).toBe(false);
});
