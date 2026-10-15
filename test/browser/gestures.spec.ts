import { drag, expect, openAt, tap, test } from "./helpers";

// The fixture's photo area is 390 × 744, starting 40 px from the top; its middle is (195, 412).
const middle: [number, number] = [195, 412];

test("swiping left goes to the next slide", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await drag(page, [300, 412], [80, 412]);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("2 / 7");
});

test("a short slow drag springs back", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await drag(page, [200, 412], [170, 412], 600);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 7");
});

test("a quick short flick changes the slide", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await drag(page, [250, 412], [200, 412], 40);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("2 / 7");
});

test("swiping right on the first slide springs back", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await drag(page, [80, 412], [300, 412]);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 7");
});

test("dragging down closes", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await drag(page, [195, 412], [195, 750]);
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
});

test("a small slow drag down springs back", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await drag(page, [195, 412], [195, 440], 600);
  await expect(page.locator("dialog")).toHaveAttribute("open", "");
});

test("a tap outside the photo closes", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await tap(page, [195, 150]);
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
});

test("a tap on a zoomable photo toggles the UI after waiting for a second tap", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await tap(page, middle);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-ui-hidden", "");
  await tap(page, middle);
  await expect(page.locator("dialog")).not.toHaveAttribute("data-dlb-ui-hidden");
});

test("a double tap zooms in and out", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await tap(page, middle);
  await tap(page, middle);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-zoomed", "");
  await expect(page.locator("dialog")).not.toHaveAttribute("data-dlb-ui-hidden");
  await tap(page, middle);
  await tap(page, middle);
  await expect(page.locator("dialog")).not.toHaveAttribute("data-dlb-zoomed");
});

test("a mouse click zooms a zoomable photo", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.mouse.click(...middle);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-zoomed", "");
});

test("a mouse click on a photo that can't zoom closes", async ({ fixture: page }) => {
  await openAt(page, "one", 2);
  await page.mouse.click(...middle);
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
});

test("dragging a zoomed photo pans it", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.locator("[data-dlb-zoom]").click();
  const media = page.locator("[data-dlb-current] > div");
  const before = (await media.boundingBox())!.x;
  await drag(page, [195, 412], [95, 412], 300);
  await expect.poll(async () => (await media.boundingBox())!.x).toBeLessThan(before - 50);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 7");
});

test("at the edge of a zoomed photo a drag goes on to the next slide", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.locator("[data-dlb-zoom]").click();
  // The first drag pans past the right edge and springs back onto it.
  await drag(page, [300, 412], [20, 412], 300);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 7");
  await drag(page, [300, 412], [80, 412]);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("2 / 7");
});

test("a tap on a video pauses it", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  await expect(page.locator("dialog")).not.toHaveAttribute("data-dlb-paused");
  await tap(page, middle);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-paused", "");
});

test("a second finger cancels a swipe", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.evaluate(async () => {
    const viewport = document.querySelector("[data-dlb-viewport]")!;
    const fire = (type: string, id: number, x: number): void => {
      const init = { pointerId: id, pointerType: "touch", clientX: x, clientY: 412, bubbles: true };
      viewport.dispatchEvent(new PointerEvent(type, init));
    };
    fire("pointerdown", 1, 300);
    for (const x of [280, 240, 200, 160]) {
      await new Promise((resolve) => setTimeout(resolve, 16));
      fire("pointermove", 1, x);
    }
    fire("pointerdown", 2, 100);
    fire("pointerup", 1, 160);
    fire("pointerup", 2, 100);
  });
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 7");
});
