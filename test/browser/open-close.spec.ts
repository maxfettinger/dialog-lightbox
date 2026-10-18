import type { Page } from "@playwright/test";
import { expect, openAt, test } from "./helpers";

test("a click on a thumbnail opens its slide", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-type", "image");
  await expect(page.locator(".count")).toHaveText("1 / 7");
  expect(await page.evaluate(() => window.log)).toEqual(["open:wide", "change:wide"]);
});

test("the counter gets the slide's number and the total element the number of slides", async ({
  fixture: page,
}) => {
  await openAt(page, "one", 2);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("3");
  await expect(page.locator("[data-dlb-total]")).toHaveText("7");
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
  await expect(page.locator(".count")).toHaveText("1 / 1");
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

test("after closing, by tap or by key, the thumbnail gets focus without a focus ring", async ({
  fixture: page,
}) => {
  const ring = (): Promise<boolean> => page.evaluate(() => document.activeElement!.matches(":focus-visible"));
  await page.locator("#one a").first().tap();
  await page.keyboard.press("ArrowRight");
  await page.locator("[data-dlb-close]").tap();
  await expect(page.locator("#one a").nth(1)).toBeFocused();
  expect(await ring()).toBe(false);
  // With the closing animation, as in use: WebKit turns the ring on for a key released after the focus moved.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator("#one a").first().tap();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page.locator("#one a").first()).toBeFocused();
  expect(await ring()).toBe(false);
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

test("a second lightbox on the same dialog cannot open while one is open", async ({ fixture: page }) => {
  await page.evaluate(() => {
    window.boxes[0]!.open(0);
    window.boxes[1]!.open(0);
  });
  await expect(page.locator("[data-dlb-slide]")).toHaveCount(2);
  expect(await page.evaluate(() => window.boxes[1]!.current)).toBeNull();
  expect(await page.evaluate(() => window.boxes[0]!.current?.id)).toBe("wide");
});

test("destroying every lightbox of a dialog leaves its markup as it was", async ({ fixture: page }) => {
  const markup = (): Promise<string> =>
    page.evaluate(() => document.querySelector("dialog")!.outerHTML.replaceAll(' style=""', ""));
  const before = await page.evaluate(() => {
    const dialog = document.querySelector("dialog")!;
    const copy = dialog.cloneNode(true) as HTMLElement;
    copy.removeAttribute("data-dlb");
    copy.querySelector("[data-dlb-viewport]")!.removeAttribute("tabindex");
    return copy.outerHTML;
  });
  await openAt(page, "one", 3);
  await page.locator("[data-dlb-close]").click();
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  // The other galleries still use the dialog.
  await page.evaluate(() => window.boxes[0]!.destroy());
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb", "");
  await openAt(page, "two", 0);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await page.evaluate(() => {
    for (const box of window.boxes) box.destroy();
  });
  expect(await markup()).toBe(before);
});

test("a destroyed lightbox does not open", async ({ fixture: page }) => {
  await page.evaluate(() => {
    window.boxes[0]!.destroy();
    window.boxes[0]!.open(0);
  });
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
});

test("destroying before the deep link opens leaves the dialog closed", async ({ fixture: page }) => {
  await page.evaluate(async () => {
    history.replaceState(null, "", "#dlb=one-2");
    window
      .lightbox({ gallery: document.getElementById("one")!, dialog: document.querySelector("dialog")! })
      .destroy();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
});

test.describe("on a phone, on a page wider than the screen", () => {
  // Mobile browsers widen the layout viewport to fit content that overflows sideways, and a fixed dialog
  // grows with it, out past the screen's right edge.
  test.use({ isMobile: true });
  test.skip(({ browserName }) => browserName === "firefox", "Firefox has no mobile emulation");

  /** Adds content 600 px wide, as an overflowing element on a real page would. */
  const widen = (page: Page) =>
    page.evaluate(() => {
      const wide = document.createElement("div");
      wide.style.cssText = "width: 600px; height: 10px";
      document.body.prepend(wide);
    });

  /** The dialog's left and right edges on the screen, and the screen's width. */
  const onScreen = (page: Page) =>
    page.evaluate(() => {
      const screen = visualViewport!;
      const box = document.querySelector("dialog")!.getBoundingClientRect();
      return [box.left - screen.offsetLeft, box.right - screen.offsetLeft, screen.width].map(Math.round);
    });

  test("the box fits the screen", async ({ fixture: page }) => {
    await widen(page);
    await openAt(page, "one", 0);
    expect(await onScreen(page)).toEqual([0, 390, 390]);
  });

  test("the box fits the screen after panning sideways", async ({ fixture: page, browserName }) => {
    test.skip(browserName === "webkit", "mobile WebKit doesn't scroll by mouse wheel");
    await widen(page);
    await page.mouse.move(300, 400);
    await page.mouse.wheel(210, 0);
    await expect.poll(() => page.evaluate(() => visualViewport!.offsetLeft)).toBe(210);
    // A click from script, so Playwright doesn't scroll the link into view first.
    await page
      .locator("#one a")
      .nth(2)
      .evaluate((link: HTMLElement) => link.click());
    await expect(page.locator("dialog")).toHaveAttribute("open", "");
    expect(await onScreen(page)).toEqual([0, 390, 390]);
  });
});
