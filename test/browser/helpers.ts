import { test as base, expect, type Page } from "@playwright/test";

/** The fixture page, opened fresh for each test; the test fails if the page throws. */
export const test = base.extend<{ fixture: Page }>({
  fixture: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/test/browser/");
    await use(page);
    expect(errors).toEqual([]);
  },
});

export { expect };

type Point = [number, number];

/** Opens gallery `galleryId` on slide `index` by clicking its link. */
export async function openAt(page: Page, galleryId: string, index: number): Promise<void> {
  await page.locator(`#${galleryId} a`).nth(index).click();
  await expect(page.locator("dialog")).toHaveAttribute("open", "");
}

/** A finger (or `kind`) pressing at `from`, moving to `to` in ten steps over `ms`, and lifting. */
export async function drag(page: Page, from: Point, to: Point, ms = 200, kind = "touch"): Promise<void> {
  await page.evaluate(
    async ({ from, to, ms, kind }) => {
      const viewport = document.querySelector("[data-dlb-viewport]");
      if (!viewport) throw new Error("no viewport");
      const fire = (type: string, x: number, y: number): void => {
        const buttons = type === "pointerup" ? 0 : 1;
        const init = {
          pointerId: 7,
          pointerType: kind,
          isPrimary: true,
          clientX: x,
          clientY: y,
          button: 0,
          buttons,
        };
        viewport.dispatchEvent(new PointerEvent(type, { ...init, bubbles: true }));
      };
      fire("pointerdown", from[0], from[1]);
      for (let i = 1; i <= 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, ms / 10));
        fire("pointermove", from[0] + ((to[0] - from[0]) * i) / 10, from[1] + ((to[1] - from[1]) * i) / 10);
      }
      fire("pointerup", to[0], to[1]);
    },
    { from, to, ms, kind },
  );
}

/** A short press without movement. */
export const tap = (page: Page, at: Point, kind = "touch"): Promise<void> => drag(page, at, at, 20, kind);
