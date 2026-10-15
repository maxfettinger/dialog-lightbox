# dialog-lightbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `dialog-lightbox` 0.1.0, a lightweight lightbox on the native `<dialog>` that adds behavior to markup the page writes itself, plus its tests, a demo with film strips, and the GitHub and npm release setup.

**Architecture:** A pure core in `src/core/` (geometry, navigation, motion, slide data, the gesture state machine, the video state machine) holds every decision and is unit-tested with `bun test`. A thin DOM shell in `src/dom/` keeps one session object per opening, calls the core, and writes styles, Web Animations and state attributes. The page owns all markup and visual CSS; the library ships about 25 lines of layout CSS.

**Tech Stack:** Bun 1.4.3 (runtime, package manager, `bun test`, `bun build`), TypeScript 7 (`strict`), Biome 2.5, Playwright 1.64 (Chromium and WebKit), ffmpeg and `sips` for media.

**Spec:** `docs/superpowers/specs/2026-10-15-dialog-lightbox-design.md`

## Global Constraints

- Size: `dist/dialog-lightbox.js` at most 6 kB minified and gzipped (6144 bytes); `dist/dialog-lightbox.css` at most 1 kB uncompressed.
- No runtime dependencies. Dev dependencies only: `typescript`, `@biomejs/biome`, `@playwright/test`, `@types/bun`.
- Browsers: Baseline 2024, Safari 17.4, Chrome and Edge 122, Firefox 132 and later. No polyfills.
- TypeScript `strict` with `noUncheckedIndexedAccess`. Functions and plain objects, no classes.
- `src/core/` never touches `document`, `window`, timers or the clock; time comes in with the inputs.
- The library ships no visual styles and creates no buttons. Attribute prefix `data-dlb-*`; custom properties `--dlb-opacity` and `--dlb-progress`.
- Gesture numbers: slop 10 px; tap under 300 ms; double tap within 300 ms and 30 px; swipe commits above 0.5 px/ms or past half the viewport width; drag down closes when `dy + 199 · vy > 0.13 · viewport height`; zoom target `min(native / fit, 3)`, zoomable from 1.2.
- Motion: open, close, zoom 300 ms with `cubic-bezier(.4, 0, .22, 1)`; slide springs ω = 30; pan and drag-back springs ω = 12; resistance `(1 − 1 / (x · 0.55 / d + 1)) · d`.
- Bun is the only local tool. Do not install Node.
- Commit messages are written with the humanizer skill (`humanizer:humanizer`, embedded mode), plain imperative subject, no attribution lines. Ask Max before any push, before creating anything on GitHub, and before publishing to npm.
- Work happens on the branch `first-version`; `main` only gets it through a pull request.

## Review Focus

These inputs are implied by the spec but easy to miss. Each one has a test in the task that owns the code.

1. A gallery with a single link: both buttons disabled, keys and swipes do nothing, counter "1 / 1" (Task 8, `navigation.spec.ts`).
2. A link without a thumbnail and without width and height: the slide opens, stays hidden until the large image has loaded, then fits (Task 7, `open-close.spec.ts`).
3. Fast repeated input, such as three arrow presses in a row: the box lands on the right slide and never holds more than three slide elements (Task 8, `navigation.spec.ts`).
4. Closing right after opening, while the large image still loads: no errors, no leftover elements, no leftover state attributes (Task 7, `open-close.spec.ts`).
5. Resizing or rotating while zoomed: zoom resets to fit (Task 10, `zoom.spec.ts`).

## File map

```
src/
  index.ts                 public exports
  dialog-lightbox.css      layout only, copied to dist/
  core/
    navigation.ts          step(), neighbours()
    geometry.ts            Size, Rect, View, fit(), thumbStart(), zoomTarget(), zoomAt(), panBounds()
    motion.ts              project(), resist(), rubber(), spring(), swipeDirection(), dismiss helpers
    slide.ts               largestWidth(), resolveSize(), slideId()
    gesture.ts             gesture() state machine
    video.ts               video() state machine
  dom/
    links.ts               readSlide(), readSlides(): SlideData from the gallery's links
    slides.ts              slide elements, placeholder, large image loading, preload()
    animate.ts             play(), stop(), placeAt(), clipAt()
    session.ts             Session, createSession(), measure(), setSlots(), place()
    controls.ts            findControls(), render(), clear()
    navigate.ts            change(), springStrip()
    transitions.ts         openAnimation(), closeAnimation(), backdrop()
    zoom.ts                zoomOf(), toggleZoom()
    video.ts               createVideo()
    pointer.ts             bindPointer()
    history.ts             createHistory(), hashId()
    lightbox.ts            lightbox(): the public entry
test/unit/                 one *.test.ts per core module (bun test)
test/browser/              fixture.html, fixture.ts, globals.d.ts, helpers.ts, media/, *.spec.ts (Playwright)
scripts/serve.ts           dev server for the fixture and the demo (byte ranges for Safari video)
scripts/size.ts            size budget check
demo/                      index.html, demo.css, demo.ts, media/, CREDITS.md
.github/workflows/         ci.yml, release.yml
package.json  tsconfig.json  tsconfig.build.json  biome.json  playwright.config.ts
README.md  LICENSE  CHANGELOG.md
```

## Refinements of the spec

The plan changes these details of the spec; none of them adds a feature.

- Files: `core/slide.ts` holds the pure helpers for reading slide data so they can be unit-tested, and the DOM shell is split into more, smaller files (`session.ts`, `navigate.ts`, `transitions.ts`, `zoom.ts`, `pointer.ts`, `links.ts`) so each task adds a file instead of growing `lightbox.ts`.
- Focus: on open the viewport gets focus (`tabindex="-1"`, no outline), not the dialog's first button. Otherwise Space on a video would press the close button.
- Deep links open on the next animation frame, so the page can register its `change` handler first.
- The release workflow installs npm 11 with `actions/setup-node`, because trusted publishing needs a newer npm than the runners may have. Bun stays the only tool on the Mac.
- npm can only set up trusted publishing for a package that exists, so 0.1.0 is published once by hand and the workflow skips versions that are on npm already.

---

### Task 1: Toolchain, project skeleton and slide navigation

**Files:**
- Modify: `~/dotfiles/Brewfile` (by `brew bundle dump`), `~/dotfiles/README.md`
- Create: `package.json`, `tsconfig.json`, `biome.json`, `src/core/navigation.ts`, `test/unit/navigation.test.ts`

**Interfaces:**
- Produces: `step(index: number, delta: number, count: number, loop: boolean): number | null` and `neighbours(index: number, count: number, loop: boolean): [number | null, number, number | null]` in `src/core/navigation.ts`.

- [ ] **Step 1: Install Bun with Homebrew and record it in the dotfiles**

```bash
brew install bun
bun --version
brew bundle dump --force --file=~/dotfiles/Brewfile
git -C ~/dotfiles diff --stat
```

Expected: `bun --version` prints `1.4.3` or a later 1.4 release; the diff shows `Brewfile` with a new `brew "bun"` line.

Add this section to `~/dotfiles/README.md`, after the "Python" section:

```markdown
## JavaScript

- [Bun](https://bun.sh) for JavaScript and TypeScript projects: `bun install`, `bun run`, `bun test`.
  There is no Node.js; Bun runs Node tools such as Playwright itself.
```

Do not commit in `~/dotfiles`. Tell Max the two files changed and ask whether to commit them there.

- [ ] **Step 2: Create the working branch**

```bash
cd /Users/mf/dev/lightweight-box
git switch -c first-version
```

- [ ] **Step 3: Write `package.json`**

```json
{
  "name": "dialog-lightbox",
  "version": "0.0.0",
  "description": "A lightweight lightbox on the native <dialog>: swipe, zoom, video. It adds behavior; the markup and CSS stay yours.",
  "keywords": ["lightbox", "dialog", "gallery", "photo", "swipe", "zoom", "video"],
  "license": "MIT",
  "author": "Maximilian Fettinger",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/maxfettinger/dialog-lightbox.git"
  },
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "default": "./dist/dialog-lightbox.js"
    },
    "./dialog-lightbox.css": "./dist/dialog-lightbox.css"
  },
  "files": ["dist"],
  "sideEffects": ["*.css"],
  "scripts": {
    "check": "biome check . && tsc",
    "test": "bun test ./test/unit"
  }
}
```

- [ ] **Step 4: Install the dev dependencies**

```bash
bun add --dev --exact typescript@7.0.2 @biomejs/biome@2.5.15 @playwright/test@1.64.1 @types/bun@1.4.3
```

Expected: `bun.lock` is created and `package.json` gets a `devDependencies` block with the four exact versions.

- [ ] **Step 5: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["bun"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "test", "scripts", "demo", "*.ts"]
}
```

- [ ] **Step 6: Write `biome.json`**

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 110 },
  "linter": {
    "rules": {
      "style": { "noNonNullAssertion": "off" }
    }
  }
}
```

`useIgnoreFile` makes Biome skip everything in `.gitignore`, including `context/`.

- [ ] **Step 7: Write the failing navigation test**

`test/unit/navigation.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { neighbours, step } from "../../src/core/navigation";

describe("step", () => {
  test("moves inside the gallery", () => {
    expect(step(1, 1, 3, false)).toBe(2);
    expect(step(1, -1, 3, false)).toBe(0);
  });

  test("stops at the ends without loop", () => {
    expect(step(2, 1, 3, false)).toBeNull();
    expect(step(0, -1, 3, false)).toBeNull();
  });

  test("wraps around with loop", () => {
    expect(step(2, 1, 3, true)).toBe(0);
    expect(step(0, -1, 3, true)).toBe(2);
  });

  test("a single slide never moves, even with loop", () => {
    expect(step(0, 1, 1, true)).toBeNull();
    expect(step(0, -1, 1, true)).toBeNull();
  });

  test("an empty gallery has nowhere to go", () => {
    expect(step(0, 1, 0, true)).toBeNull();
  });
});

describe("neighbours", () => {
  test("previous, current and next", () => {
    expect(neighbours(1, 3, false)).toEqual([0, 1, 2]);
  });

  test("nothing past the ends", () => {
    expect(neighbours(0, 1, false)).toEqual([null, 0, null]);
    expect(neighbours(2, 3, false)).toEqual([1, 2, null]);
  });

  test("two looping slides: the other one appears once, as next", () => {
    expect(neighbours(0, 2, true)).toEqual([null, 0, 1]);
  });
});
```

- [ ] **Step 8: Run it and see it fail**

Run: `bun test ./test/unit`
Expected: FAIL, the module `../../src/core/navigation` cannot be found.

- [ ] **Step 9: Implement `src/core/navigation.ts`**

```ts
// Which slide comes next: indices with or without looping, and the neighbours to render.

/** The index `delta` slides away from `index`, or null when that leaves the gallery. */
export function step(index: number, delta: number, count: number, loop: boolean): number | null {
  const target = index + delta;
  if (target >= 0 && target < count) return target;
  if (!loop || count < 2) return null;
  return ((target % count) + count) % count;
}

/** Previous, current and next index. With two looping slides the other one appears once, as next. */
export function neighbours(index: number, count: number, loop: boolean): [number | null, number, number | null] {
  const prev = step(index, -1, count, loop);
  const next = step(index, 1, count, loop);
  return [prev === next ? null : prev, index, next];
}
```

- [ ] **Step 10: Run the tests and the checks**

Run: `bun test ./test/unit`
Expected: PASS, 8 tests.

Run: `bunx biome check --write . && bun run check`
Expected: no errors. If `tsc` reports that TypeScript 7 rejects an option in `tsconfig.json`, remove only that option and note it in the commit message.

- [ ] **Step 11: Commit**

```bash
git add package.json bun.lock tsconfig.json biome.json src/core/navigation.ts test/unit/navigation.test.ts
git commit -m "Set up Bun, TypeScript and Biome, and add slide navigation" -m "step() and neighbours() decide which slide comes next, with or without looping. They are the first pure core module and prove the toolchain works."
```

---

### Task 2: Geometry

**Files:**
- Create: `src/core/geometry.ts`, `test/unit/geometry.test.ts`

**Interfaces:**
- Produces, all from `src/core/geometry.ts`:
  - types `Size { width; height }`, `Point { x; y }`, `Rect extends Point, Size`, `Insets { top; right; bottom; left }`, `View { scale; x; y }`, `Bounds { minX; maxX; minY; maxY }`
  - constants `FIT_VIEW: View` (`{ scale: 1, x: 0, y: 0 }`), `NO_INSETS: Insets`
  - `clamp(value, min, max): number`
  - `fit(media: Size, area: Rect): Rect`
  - `viewRect(fitRect: Rect, view: View): Rect`
  - `thumbStart(box: Rect, media: Size, cover: boolean): { rect: Rect; clip: Insets }`
  - `zoomTarget(nativeWidth: number | undefined, fitWidth: number): number | null`
  - `zoomAt(view: View, fitRect: Rect, point: Point, scale: number): View`
  - `panBounds(fitRect: Rect, scale: number, viewport: Size): Bounds`
  - `clampView(view: View, bounds: Bounds): View`

- [ ] **Step 1: Write the failing tests**

`test/unit/geometry.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  clampView,
  FIT_VIEW,
  fit,
  panBounds,
  thumbStart,
  viewRect,
  zoomAt,
  zoomTarget,
} from "../../src/core/geometry";

describe("fit", () => {
  test("a wide photo fills the width and is centered vertically", () => {
    const r = fit({ width: 1600, height: 1067 }, { x: 0, y: 0, width: 400, height: 800 });
    expect(r.width).toBeCloseTo(400);
    expect(r.height).toBeCloseTo(266.75);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(266.625);
  });

  test("respects the padded area", () => {
    const r = fit({ width: 1000, height: 1000 }, { x: 16, y: 48, width: 368, height: 600 });
    expect(r.x).toBeCloseTo(16);
    expect(r.y).toBeCloseTo(164);
    expect(r.width).toBeCloseTo(368);
    expect(r.height).toBeCloseTo(368);
  });
});

describe("viewRect", () => {
  test("offsets and scales the fit rectangle", () => {
    expect(viewRect({ x: 10, y: 20, width: 100, height: 50 }, { scale: 2, x: -5, y: 5 })).toEqual({
      x: 5,
      y: 25,
      width: 200,
      height: 100,
    });
  });
});

describe("thumbStart", () => {
  test("a cover-cropped portrait thumbnail: the whole photo overflows the box and is clipped back", () => {
    const { rect, clip } = thumbStart({ x: 10, y: 20, width: 180, height: 120 }, { width: 1080, height: 1920 }, true);
    expect(rect.x).toBeCloseTo(10);
    expect(rect.y).toBeCloseTo(-80);
    expect(rect.width).toBeCloseTo(180);
    expect(rect.height).toBeCloseTo(320);
    expect(clip.top).toBeCloseTo(100);
    expect(clip.bottom).toBeCloseTo(100);
    expect(clip.left).toBeCloseTo(0);
    expect(clip.right).toBeCloseTo(0);
  });

  test("an uncropped thumbnail is its own box", () => {
    const box = { x: 1, y: 2, width: 30, height: 20 };
    expect(thumbStart(box, { width: 300, height: 200 }, false)).toEqual({
      rect: box,
      clip: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });
});

describe("zoomTarget", () => {
  test("up to three times the fit size", () => {
    expect(zoomTarget(1600, 400)).toBe(3);
  });

  test("never past the native width", () => {
    expect(zoomTarget(600, 400)).toBe(1.5);
  });

  test("no zoom below 1.2 or without a native width", () => {
    expect(zoomTarget(440, 400)).toBeNull();
    expect(zoomTarget(undefined, 400)).toBeNull();
  });
});

describe("zoomAt", () => {
  test("keeps the point under the finger", () => {
    const fitRect = { x: 0, y: 100, width: 400, height: 300 };
    const view = zoomAt(FIT_VIEW, fitRect, { x: 100, y: 250 }, 2);
    expect(view).toEqual({ scale: 2, x: -100, y: -150 });
    const r = viewRect(fitRect, view);
    expect(r.x + 100 * 2).toBe(100);
    expect(r.y + 150 * 2).toBe(250);
  });
});

describe("panBounds and clampView", () => {
  const fitRect = { x: 0, y: 100, width: 400, height: 300 };

  test("zoomed media must cover the viewport", () => {
    expect(panBounds(fitRect, 2, { width: 400, height: 500 })).toEqual({ minX: -400, maxX: 0, minY: -200, maxY: -100 });
  });

  test("an axis smaller than the viewport stays centered", () => {
    expect(panBounds(fitRect, 1, { width: 400, height: 500 })).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  });

  test("clampView keeps the scale and clamps the offsets", () => {
    const bounds = { minX: -400, maxX: 0, minY: -200, maxY: -100 };
    expect(clampView({ scale: 2, x: -500, y: 0 }, bounds)).toEqual({ scale: 2, x: -400, y: -100 });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun test ./test/unit/geometry.test.ts`
Expected: FAIL, module `../../src/core/geometry` not found.

- [ ] **Step 3: Implement `src/core/geometry.ts`**

```ts
// Geometry in CSS pixels, relative to the viewport element's top-left corner.

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point, Size {}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Where the current media are: offset from their fit position, and scale relative to the fit size. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

/** The view offsets that keep a zoomed photo covering the viewport. */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const FIT_VIEW: View = { scale: 1, x: 0, y: 0 };
export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** The largest rectangle with the media's aspect ratio inside `area`, centered in it. */
export function fit(media: Size, area: Rect): Rect {
  const scale = Math.min(area.width / media.width, area.height / media.height);
  const width = media.width * scale;
  const height = media.height * scale;
  return { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
}

/** The media's rectangle on screen for a view. */
export function viewRect(fitRect: Rect, view: View): Rect {
  return {
    x: fitRect.x + view.x,
    y: fitRect.y + view.y,
    width: fitRect.width * view.scale,
    height: fitRect.height * view.scale,
  };
}

/**
 * The thumbnail's frame for the opening and closing zoom. With `object-fit: cover` the whole photo is
 * larger than the thumbnail's box and centered on it; the insets clip it back to the box.
 */
export function thumbStart(box: Rect, media: Size, cover: boolean): { rect: Rect; clip: Insets } {
  if (!cover) return { rect: box, clip: NO_INSETS };
  const scale = Math.max(box.width / media.width, box.height / media.height);
  const width = media.width * scale;
  const height = media.height * scale;
  const left = (width - box.width) / 2;
  const top = (height - box.height) / 2;
  return {
    rect: { x: box.x - left, y: box.y - top, width, height },
    clip: { top, right: left, bottom: top, left },
  };
}

/** How far a photo zooms: up to 3 times its fit size, never past its native width; null below 1.2. */
export function zoomTarget(nativeWidth: number | undefined, fitWidth: number): number | null {
  if (!nativeWidth) return null;
  const zoom = Math.min(nativeWidth / fitWidth, 3);
  return zoom >= 1.2 ? zoom : null;
}

/** The view at `scale` that keeps the media point under `point` where it is. */
export function zoomAt(view: View, fitRect: Rect, point: Point, scale: number): View {
  const localX = (point.x - fitRect.x - view.x) / view.scale;
  const localY = (point.y - fitRect.y - view.y) / view.scale;
  return { scale, x: point.x - fitRect.x - localX * scale, y: point.y - fitRect.y - localY * scale };
}

/** Offsets that keep media at `scale` covering the viewport, or centered on an axis where they are smaller. */
export function panBounds(fitRect: Rect, scale: number, viewport: Size): Bounds {
  const [minX, maxX] = axis(fitRect.width * scale, viewport.width, fitRect.x);
  const [minY, maxY] = axis(fitRect.height * scale, viewport.height, fitRect.y);
  return { minX, maxX, minY, maxY };
}

function axis(size: number, space: number, start: number): [number, number] {
  if (size <= space) {
    const center = (space - size) / 2 - start;
    return [center, center];
  }
  // 0 - start, not -start: with start = 0 that would be -0, which equality checks treat as different.
  return [space - size - start, 0 - start];
}

export function clampView(view: View, bounds: Bounds): View {
  return {
    scale: view.scale,
    x: clamp(view.x, bounds.minX, bounds.maxX),
    y: clamp(view.y, bounds.minY, bounds.maxY),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `bun test ./test/unit`
Expected: PASS (navigation and geometry).

Run: `bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/geometry.ts test/unit/geometry.test.ts
git commit -m "Add the geometry for fitting, cropping and zooming" -m "fit() places a photo in the viewport's padded box, thumbStart() gives the opening zoom its starting frame for object-fit: cover thumbnails, and zoomAt(), panBounds() and clampView() handle zooming around a point and panning."
```

---

### Task 3: Motion

**Files:**
- Create: `src/core/motion.ts`, `test/unit/motion.test.ts`

**Interfaces:**
- Consumes: `clamp`, `Size`, `View` from `src/core/geometry.ts`.
- Produces, from `src/core/motion.ts`:
  - `project(velocity: number): number` (px/ms in, px out, about 199 · v)
  - `resist(overshoot: number, dimension: number): number`
  - `rubber(value: number, min: number, max: number, dimension: number): number`
  - `interface SpringFrames { frames: number[][]; duration: number }` and `spring(from: number[], to: number[], velocity: number[], omega: number): SpringFrames` (31 frames; the last one equals `to` exactly)
  - `swipeDirection(dx: number, vx: number, width: number): -1 | 0 | 1` (1 means the next slide)
  - `dismissProgress(dy: number, height: number): number`
  - `shouldDismiss(dy: number, vy: number, height: number): boolean`
  - `dismissView(fitSize: Size, dx: number, dy: number, progress: number): View`

- [ ] **Step 1: Write the failing tests**

`test/unit/motion.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  dismissProgress,
  dismissView,
  project,
  resist,
  rubber,
  shouldDismiss,
  spring,
  swipeDirection,
} from "../../src/core/motion";

describe("project", () => {
  test("momentum carries about 199 times the velocity", () => {
    expect(project(1)).toBeCloseTo(199);
    expect(project(-0.5)).toBeCloseTo(-99.5);
  });
});

describe("resist and rubber", () => {
  test("resistance grows slower than the finger and stays under the dimension", () => {
    expect(resist(0, 100)).toBe(0);
    expect(resist(50, 100)).toBeCloseTo(21.57, 1);
    expect(resist(10_000, 100)).toBeLessThan(100);
    expect(resist(-50, 100)).toBeCloseTo(-resist(50, 100));
  });

  test("rubber leaves values inside the range alone", () => {
    expect(rubber(5, 0, 10, 100)).toBe(5);
    expect(rubber(-50, 0, 10, 100)).toBeCloseTo(-21.57, 1);
    expect(rubber(60, 0, 10, 100)).toBeCloseTo(10 + 21.57, 1);
  });
});

describe("spring", () => {
  test("starts at the start values and ends exactly on the targets", () => {
    const { frames, duration } = spring([400, 10], [0, 10], [0, 0], 30);
    expect(frames).toHaveLength(31);
    expect(frames[0]).toEqual([400, 10]);
    expect(frames.at(-1)).toEqual([0, 10]);
    expect(duration).toBeGreaterThan(200);
    expect(duration).toBeLessThan(400);
  });

  test("without velocity a critically damped spring never overshoots", () => {
    const { frames } = spring([100], [0], [0], 30);
    expect(Math.min(...frames.map((frame) => frame[0] ?? 0))).toBeGreaterThanOrEqual(0);
  });

  test("a fast release toward the target overshoots once", () => {
    const { frames } = spring([100], [0], [-5], 30);
    expect(Math.min(...frames.map((frame) => frame[0] ?? 0))).toBeLessThan(0);
  });

  test("nothing to move takes no time", () => {
    expect(spring([5], [5], [0], 30).duration).toBe(0);
  });
});

describe("swipeDirection", () => {
  test("a fast flick decides by its direction", () => {
    expect(swipeDirection(-20, -0.8, 400)).toBe(1);
    expect(swipeDirection(20, 0.8, 400)).toBe(-1);
  });

  test("a slow drag past half the width changes the slide", () => {
    expect(swipeDirection(-210, -0.1, 400)).toBe(1);
    expect(swipeDirection(210, 0.1, 400)).toBe(-1);
  });

  test("a short slow drag stays", () => {
    expect(swipeDirection(-150, -0.2, 400)).toBe(0);
  });
});

describe("drag down to close", () => {
  test("progress reaches 1 after a third of the height", () => {
    expect(dismissProgress(0, 900)).toBe(0);
    expect(dismissProgress(150, 900)).toBe(0.5);
    expect(dismissProgress(600, 900)).toBe(1);
    expect(dismissProgress(-50, 900)).toBe(0);
  });

  test("closes past 13% of the height, or earlier with a flick", () => {
    expect(shouldDismiss(120, 0, 800)).toBe(true);
    expect(shouldDismiss(50, 0, 800)).toBe(false);
    expect(shouldDismiss(0, 1, 800)).toBe(true);
  });

  test("the media follow the finger and shrink around their center", () => {
    const view = dismissView({ width: 400, height: 300 }, 10, 100, 0.5);
    expect(view.scale).toBeCloseTo(0.9);
    expect(view.x).toBeCloseTo(30);
    expect(view.y).toBeCloseTo(115);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun test ./test/unit/motion.test.ts`
Expected: FAIL, module `../../src/core/motion` not found.

- [ ] **Step 3: Implement `src/core/motion.ts`**

```ts
// Motion: release momentum, resistance past an edge, springs sampled into keyframes, and the decisions a
// release makes (change the slide, close the box).
import { clamp, type Size, type View } from "./geometry";

const DECELERATION = 0.995;
const STEPS = 30;

/** How far momentum carries a release at `velocity` px/ms: about 199 times the velocity. */
export const project = (velocity: number): number => (velocity * DECELERATION) / (1 - DECELERATION);

/** Resistance past an edge, as on iOS: `overshoot` px of finger movement move less, never `dimension`. */
export function resist(overshoot: number, dimension: number): number {
  const distance = Math.abs(overshoot);
  return Math.sign(overshoot) * (1 - 1 / ((distance * 0.55) / dimension + 1)) * dimension;
}

/** `value`, with resistance where it leaves [min, max]. */
export function rubber(value: number, min: number, max: number, dimension: number): number {
  if (value < min) return min + resist(value - min, dimension);
  if (value > max) return max + resist(value - max, dimension);
  return value;
}

export interface SpringFrames {
  /** STEPS + 1 frames, evenly spaced in time, with one value per animated number. */
  frames: number[][];
  /** Milliseconds. */
  duration: number;
}

/**
 * Critically damped springs from `from` to `to`, one per number, each starting at its `velocity` (px/ms).
 * The frames are meant for a Web Animation with linear easing between them. `omega` is in rad/s.
 */
export function spring(from: number[], to: number[], velocity: number[], omega: number): SpringFrames {
  const curves = from.map((start, i) => curve(start - (to[i] ?? 0), velocity[i] ?? 0, omega / 1000));
  const duration = Math.max(0, ...curves.map((c) => c.duration));
  const frames = Array.from({ length: STEPS + 1 }, (_, n) =>
    to.map((target, i) => (n === STEPS ? target : target + (curves[i]?.offset((n / STEPS) * duration) ?? 0))),
  );
  return { frames, duration };
}

/** Offset from the target over time (ms) for start offset `d` and velocity `v`; `w` is omega per ms. */
function curve(d: number, v: number, w: number): { offset: (t: number) => number; duration: number } {
  const b = v + w * d;
  const offset = (t: number): number => (d + b * t) * Math.exp(-w * t);
  const speed = (t: number): number => (b - w * (d + b * t)) * Math.exp(-w * t);
  let duration = 0;
  while (duration < 2000 && (Math.abs(offset(duration)) > 0.5 || Math.abs(speed(duration)) > 0.05)) duration += 8;
  return { offset, duration };
}

/** A swipe's result: 1 for the next slide, -1 for the previous one, 0 to stay. Negative dx and vx point left. */
export function swipeDirection(dx: number, vx: number, width: number): -1 | 0 | 1 {
  if (Math.abs(vx) > 0.5) return vx < 0 ? 1 : -1;
  if (Math.abs(dx) > width / 2) return dx < 0 ? 1 : -1;
  return 0;
}

/** Progress of a drag down: 0 at rest, 1 after a third of the viewport height. */
export const dismissProgress = (dy: number, height: number): number => clamp(dy / (height / 3), 0, 1);

/** Whether a drag down released at `dy` with velocity `vy` closes the box. */
export const shouldDismiss = (dy: number, vy: number, height: number): boolean => dy + project(vy) > 0.13 * height;

/** The view while dragging down: the media follow the finger and shrink around their center. */
export function dismissView(fitSize: Size, dx: number, dy: number, progress: number): View {
  const scale = 1 - 0.2 * progress;
  return { scale, x: dx + (fitSize.width * (1 - scale)) / 2, y: dy + (fitSize.height * (1 - scale)) / 2 };
}
```

- [ ] **Step 4: Run the tests**

Run: `bun test ./test/unit`
Expected: PASS.

Run: `bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/motion.ts test/unit/motion.test.ts
git commit -m "Add springs, momentum and the release decisions" -m "spring() samples critically damped springs into keyframes for the Web Animations API. swipeDirection() and shouldDismiss() turn a release into a slide change or a close, using the thresholds from the spec."
```

---

### Task 4: Slide data helpers

**Files:**
- Create: `src/core/slide.ts`, `test/unit/slide.test.ts`

**Interfaces:**
- Consumes: `Size` from `src/core/geometry.ts`.
- Produces, from `src/core/slide.ts`:
  - `largestWidth(srcset: string | undefined): number | undefined`
  - `interface SizeInfo { aspect: Size | null; native: number | undefined }`
  - `resolveSize(width: number, height: number, thumb: Size | null, srcset: string | undefined): SizeInfo` (width and height are `NaN` when the attributes are missing)
  - `slideId(explicit: string | undefined, galleryId: string, index: number): string`

- [ ] **Step 1: Write the failing tests**

`test/unit/slide.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { largestWidth, resolveSize, slideId } from "../../src/core/slide";

describe("largestWidth", () => {
  test("the largest w descriptor, in any order", () => {
    expect(largestWidth("a.webp 1080w, b.webp 1600w")).toBe(1600);
    expect(largestWidth("b.webp 1600w,a.webp 1080w")).toBe(1600);
  });

  test("nothing without w descriptors", () => {
    expect(largestWidth("a.webp 2x")).toBeUndefined();
    expect(largestWidth("a.webp")).toBeUndefined();
    expect(largestWidth(undefined)).toBeUndefined();
  });
});

describe("resolveSize", () => {
  test("width and height attributes win", () => {
    expect(resolveSize(1600, 1067, { width: 480, height: 320 }, "a.webp 1080w")).toEqual({
      aspect: { width: 1600, height: 1067 },
      native: 1600,
    });
  });

  test("otherwise the thumbnail's aspect ratio and the srcset's largest width", () => {
    expect(resolveSize(Number.NaN, Number.NaN, { width: 300, height: 450 }, "a.webp 600w")).toEqual({
      aspect: { width: 300, height: 450 },
      native: 600,
    });
  });

  test("unknown until the image loads when nothing tells", () => {
    expect(resolveSize(Number.NaN, Number.NaN, null, undefined)).toEqual({ aspect: null, native: undefined });
    expect(resolveSize(Number.NaN, Number.NaN, { width: 0, height: 0 }, undefined)).toEqual({
      aspect: null,
      native: undefined,
    });
  });
});

describe("slideId", () => {
  test("data-dlb-id, or the gallery id and the slide's number", () => {
    expect(slideId("ferry", "one", 0)).toBe("ferry");
    expect(slideId(undefined, "one", 1)).toBe("one-2");
    expect(slideId("", "g1", 0)).toBe("g1-1");
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun test ./test/unit/slide.test.ts`
Expected: FAIL, module `../../src/core/slide` not found.

- [ ] **Step 3: Implement `src/core/slide.ts`**

```ts
// Reading a slide's size and id from its link's attributes, without the DOM.
import type { Size } from "./geometry";

/** The largest width descriptor in a srcset: "a.webp 1080w, b.webp 1600w" gives 1600. */
export function largestWidth(srcset: string | undefined): number | undefined {
  let max = 0;
  for (const candidate of srcset?.split(",") ?? []) {
    const match = /\s(\d+)w$/.exec(candidate.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max || undefined;
}

export interface SizeInfo {
  /** Aspect ratio as a size; null until the large image has loaded. */
  aspect: Size | null;
  /** Native width in CSS pixels, for zooming. */
  native: number | undefined;
}

/** Width and height attributes first, then the thumbnail's aspect ratio with the srcset's largest width. */
export function resolveSize(width: number, height: number, thumb: Size | null, srcset: string | undefined): SizeInfo {
  if (width > 0 && height > 0) return { aspect: { width, height }, native: width };
  const aspect = thumb && thumb.width > 0 && thumb.height > 0 ? thumb : null;
  return { aspect, native: largestWidth(srcset) };
}

export const slideId = (explicit: string | undefined, galleryId: string, index: number): string =>
  explicit || `${galleryId}-${index + 1}`;
```

- [ ] **Step 4: Run the tests**

Run: `bun test ./test/unit`
Expected: PASS.

Run: `bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/slide.ts test/unit/slide.test.ts
git commit -m "Read slide sizes from attributes, thumbnails and srcset" -m "Width and height attributes are optional: without them the aspect ratio comes from the thumbnail and the native width from the srcset's largest w descriptor."
```

---

### Task 5: The gesture state machine

**Files:**
- Create: `src/core/gesture.ts`, `test/unit/gesture.test.ts`

**Interfaces:**
- Produces, from `src/core/gesture.ts`:
  - `type PointerKind = "mouse" | "touch" | "pen"`, `type Mode = "swipe" | "pan" | "dismiss"`
  - `interface Target { area: "media" | "outside"; type: "image" | "video"; zoomable: boolean; zoomed: boolean; atLeft: boolean; atRight: boolean }`
  - `type GestureInput`: `{ type: "down"; id; x; y; t; kind; target: Target }`, `{ type: "move" | "up" | "cancel"; id; x; y; t; kind }`, `{ type: "timeout"; t }`
  - `type Intent`: `drag { mode; dx; dy }` (starts at 0, 0), `release { mode; dx; dy; vx; vy }` (velocities in px/ms), `abort { mode }`, `tap { x; y; kind; target }`, `double-tap { x; y; target }`
  - `interface GestureState` (flat record with `phase: "idle" | "pressed" | "dragging" | "ignored" | "blocked"`, `pending`, and more), `const initialGesture: GestureState`
  - `interface GestureStep { state: GestureState; intents: Intent[]; timer?: number | null }`: `timer` is a delay in ms to start the one timer, `null` to cancel it, absent to leave it.
  - `gesture(state: GestureState, input: GestureInput): GestureStep`

- [ ] **Step 1: Write the failing tests**

`test/unit/gesture.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  type GestureInput,
  type GestureState,
  type GestureStep,
  gesture,
  initialGesture,
  type Intent,
  type PointerKind,
  type Target,
} from "../../src/core/gesture";

const photo: Target = { area: "media", type: "image", zoomable: false, zoomed: false, atLeft: true, atRight: true };
const zoomable: Target = { ...photo, zoomable: true };

function down(x: number, y: number, t: number, target = photo, kind: PointerKind = "touch", id = 1): GestureInput {
  return { type: "down", id, x, y, t, kind, target };
}

function at(type: "move" | "up" | "cancel", x: number, y: number, t: number, id = 1, kind: PointerKind = "touch"): GestureInput {
  return { type, id, x, y, t, kind };
}

/** Feeds the inputs in order: the last state, every intent, and the last timer request. */
function run(inputs: GestureInput[], start: GestureState = initialGesture) {
  let state = start;
  const intents: Intent[] = [];
  let timer: GestureStep["timer"];
  for (const input of inputs) {
    const result = gesture(state, input);
    state = result.state;
    intents.push(...result.intents);
    if (result.timer !== undefined) timer = result.timer;
  }
  return { state, intents, timer };
}

describe("taps", () => {
  test("a quick press without movement is a tap", () => {
    const { state, intents } = run([down(100, 100, 0), at("up", 102, 101, 80)]);
    expect(intents).toEqual([{ type: "tap", x: 102, y: 101, kind: "touch", target: photo }]);
    expect(state.phase).toBe("idle");
  });

  test("movement under the 10 px slop still ends in a tap", () => {
    const { intents } = run([down(100, 100, 0), at("move", 106, 105, 30), at("up", 106, 105, 60)]);
    expect(intents.map((intent) => intent.type)).toEqual(["tap"]);
  });

  test("a press longer than 300 ms is no tap", () => {
    expect(run([down(100, 100, 0), at("up", 100, 100, 400)]).intents).toEqual([]);
  });

  test("a tap on a zoomable photo waits 300 ms for a second tap", () => {
    const first = run([down(100, 100, 0, zoomable), at("up", 100, 100, 50)]);
    expect(first.intents).toEqual([]);
    expect(first.timer).toBe(300);
    const later = gesture(first.state, { type: "timeout", t: 350 });
    expect(later.intents).toEqual([{ type: "tap", x: 100, y: 100, kind: "touch", target: zoomable }]);
  });

  test("two taps close together are a double tap", () => {
    const { intents, timer } = run([
      down(100, 100, 0, zoomable),
      at("up", 100, 100, 50),
      down(110, 105, 150, zoomable),
      at("up", 110, 105, 200),
    ]);
    expect(intents).toEqual([{ type: "double-tap", x: 110, y: 105, target: zoomable }]);
    expect(timer).toBeNull();
  });

  test("a second tap far away lets the first one stand alone", () => {
    const { intents, timer, state } = run([
      down(100, 100, 0, zoomable),
      at("up", 100, 100, 50),
      down(200, 100, 150, zoomable),
      at("up", 200, 100, 200),
    ]);
    expect(intents).toEqual([{ type: "tap", x: 100, y: 100, kind: "touch", target: zoomable }]);
    expect(timer).toBe(300);
    expect(state.pending?.x).toBe(200);
  });

  test("mouse clicks act at once, even on zoomable photos", () => {
    const { intents, timer } = run([down(100, 100, 0, zoomable, "mouse"), at("up", 100, 100, 50, 1, "mouse")]);
    expect(intents).toEqual([{ type: "tap", x: 100, y: 100, kind: "mouse", target: zoomable }]);
    expect(timer).toBeUndefined();
  });

  test("a press that turns into a drag lets a waiting tap go first", () => {
    const { intents, timer } = run([
      down(100, 100, 0, zoomable),
      at("up", 100, 100, 50),
      down(100, 100, 100, zoomable),
      at("move", 70, 100, 120),
    ]);
    expect(intents.map((intent) => intent.type)).toEqual(["tap", "drag"]);
    expect(timer).toBeNull();
  });
});

describe("drags", () => {
  test("horizontal movement past the slop is a swipe, counted from where it was recognised", () => {
    const { intents } = run([
      down(200, 300, 0),
      at("move", 185, 300, 16),
      at("move", 150, 300, 32),
      at("up", 150, 300, 48),
    ]);
    expect(intents[0]).toEqual({ type: "drag", mode: "swipe", dx: 0, dy: 0 });
    expect(intents[1]).toEqual({ type: "drag", mode: "swipe", dx: -35, dy: 0 });
    const release = intents[2];
    if (release?.type !== "release") throw new Error("expected a release");
    expect(release.dx).toBe(-35);
    expect(release.vx).toBeCloseTo(-50 / 48);
    expect(release.vy).toBe(0);
  });

  test("a drag down is a dismiss", () => {
    expect(run([down(195, 400, 0), at("move", 195, 420, 16)]).intents).toEqual([
      { type: "drag", mode: "dismiss", dx: 0, dy: 0 },
    ]);
  });

  test("a drag up does nothing", () => {
    const { intents, state } = run([
      down(195, 400, 0),
      at("move", 195, 380, 16),
      at("move", 195, 300, 32),
      at("up", 195, 300, 48),
    ]);
    expect(intents).toEqual([]);
    expect(state.phase).toBe("idle");
  });

  test("zoomed photos pan in every direction", () => {
    const zoomed = { ...zoomable, zoomed: true, atLeft: false, atRight: false };
    expect(run([down(200, 300, 0, zoomed), at("move", 170, 300, 16)]).intents[0]).toMatchObject({ mode: "pan" });
    expect(run([down(200, 300, 0, zoomed), at("move", 200, 330, 16)]).intents[0]).toMatchObject({ mode: "pan" });
  });

  test("at the right edge of a zoomed photo, dragging left swipes", () => {
    const atRight = { ...zoomable, zoomed: true, atLeft: false, atRight: true };
    expect(run([down(200, 300, 0, atRight), at("move", 170, 300, 16)]).intents[0]).toMatchObject({ mode: "swipe" });
    expect(run([down(200, 300, 0, atRight), at("move", 230, 300, 16)]).intents[0]).toMatchObject({ mode: "pan" });
  });

  test("velocity only counts the last 100 ms", () => {
    const { intents } = run([
      down(300, 300, 0),
      at("move", 290, 300, 100),
      at("move", 280, 300, 200),
      at("move", 279, 300, 300),
      at("move", 230, 300, 316),
      at("up", 230, 300, 332),
    ]);
    const release = intents.at(-1);
    if (release?.type !== "release") throw new Error("expected a release");
    expect(release.vx).toBeCloseTo(-49 / 32);
  });
});

describe("interruptions", () => {
  test("a second finger aborts the drag and blocks until every finger is up", () => {
    const blocked = run([down(200, 300, 0), at("move", 170, 300, 16), down(100, 300, 20, photo, "touch", 2)]);
    expect(blocked.intents.at(-1)).toEqual({ type: "abort", mode: "swipe" });
    expect(blocked.state.phase).toBe("blocked");
    const oneUp = run([at("up", 170, 300, 40)], blocked.state);
    expect(oneUp.state.phase).toBe("blocked");
    const allUp = run([at("move", 100, 300, 50, 2), at("up", 100, 300, 60, 2)], oneUp.state);
    expect(allUp.intents).toEqual([]);
    expect(allUp.state.phase).toBe("idle");
  });

  test("pointercancel aborts a drag without a tap", () => {
    const { intents, state } = run([down(200, 300, 0), at("move", 170, 300, 16), at("cancel", 170, 300, 20)]);
    expect(intents.at(-1)).toEqual({ type: "abort", mode: "swipe" });
    expect(state.phase).toBe("idle");
  });

  test("pointercancel during a press gives no tap", () => {
    expect(run([down(200, 300, 0), at("cancel", 200, 300, 20)]).intents).toEqual([]);
  });

  test("moves of other pointers are ignored", () => {
    expect(run([down(200, 300, 0), at("move", 100, 300, 16, 2)]).intents).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun test ./test/unit/gesture.test.ts`
Expected: FAIL, module `../../src/core/gesture` not found.

- [ ] **Step 3: Implement `src/core/gesture.ts`**

```ts
// The gesture state machine: pointer events in, intents out. Pure: time comes with the inputs, and the
// 300 ms wait for a double tap is a timer the caller runs and reports back as a "timeout" input.

export type PointerKind = "mouse" | "touch" | "pen";
export type Mode = "swipe" | "pan" | "dismiss";

/** What is under the pointer when it goes down; the DOM shell measures it. */
export interface Target {
  area: "media" | "outside";
  type: "image" | "video";
  zoomable: boolean;
  zoomed: boolean;
  /** A zoomed photo that is already at its left (or right) pan bound. */
  atLeft: boolean;
  atRight: boolean;
}

interface PointerInput {
  id: number;
  x: number;
  y: number;
  t: number;
  kind: PointerKind;
}

export type GestureInput =
  | (PointerInput & { type: "down"; target: Target })
  | (PointerInput & { type: "move" | "up" | "cancel" })
  | { type: "timeout"; t: number };

export type Intent =
  // A drag in progress. dx and dy count from where the drag was recognised, so it starts at 0, 0.
  | { type: "drag"; mode: Mode; dx: number; dy: number }
  | { type: "release"; mode: Mode; dx: number; dy: number; vx: number; vy: number }
  // A drag ended by a second finger or by the browser: spring back.
  | { type: "abort"; mode: Mode }
  | { type: "tap"; x: number; y: number; kind: PointerKind; target: Target }
  | { type: "double-tap"; x: number; y: number; target: Target };

interface Sample {
  x: number;
  y: number;
  t: number;
}

interface Tap extends Sample {
  kind: PointerKind;
  target: Target;
}

export interface GestureState {
  phase: "idle" | "pressed" | "dragging" | "ignored" | "blocked";
  /** The pointer being followed. */
  id: number;
  kind: PointerKind;
  target: Target | null;
  mode: Mode | null;
  start: Sample;
  /** Where the drag was recognised. */
  origin: Sample;
  /** Positions of the last 100 ms, for the release velocity. */
  samples: Sample[];
  /** Every pointer that is down. */
  pointers: number[];
  /** A single tap waiting for a possible second one. */
  pending: Tap | null;
}

export interface GestureStep {
  state: GestureState;
  intents: Intent[];
  /** Start the timer with this delay in ms, cancel it (null), or leave it alone (undefined). */
  timer?: number | null;
}

export const SLOP = 10;
export const TAP_MS = 300;
export const DOUBLE_TAP_PX = 30;
const VELOCITY_MS = 100;

const ZERO: Sample = { x: 0, y: 0, t: 0 };

export const initialGesture: GestureState = {
  phase: "idle",
  id: -1,
  kind: "mouse",
  target: null,
  mode: null,
  start: ZERO,
  origin: ZERO,
  samples: [],
  pointers: [],
  pending: null,
};

export function gesture(state: GestureState, input: GestureInput): GestureStep {
  switch (input.type) {
    case "timeout":
      return state.pending
        ? { state: { ...state, pending: null }, intents: [tapOf(state.pending)] }
        : { state, intents: [] };
    case "down":
      return down(state, input);
    case "move":
      return move(state, input);
    case "up":
      return up(state, input);
    case "cancel":
      return cancel(state, input);
  }
}

function down(s: GestureState, i: PointerInput & { target: Target }): GestureStep {
  const pointers = [...s.pointers, i.id];
  if (s.phase !== "idle") {
    // v1 follows one finger: a second one cancels the gesture until every finger is up.
    const intents: Intent[] = s.phase === "dragging" && s.mode ? [{ type: "abort", mode: s.mode }] : [];
    return { state: { ...s, phase: "blocked", pointers }, intents };
  }
  const p = sample(i);
  return {
    state: { ...s, phase: "pressed", id: i.id, kind: i.kind, target: i.target, mode: null, start: p, origin: p, samples: [p], pointers },
    intents: [],
  };
}

function move(s: GestureState, i: PointerInput): GestureStep {
  if (i.id !== s.id || (s.phase !== "pressed" && s.phase !== "dragging")) return { state: s, intents: [] };
  const p = sample(i);
  const samples = recent([...s.samples, p]);
  if (s.phase === "dragging") {
    return {
      state: { ...s, samples },
      intents: [{ type: "drag", mode: s.mode!, dx: p.x - s.origin.x, dy: p.y - s.origin.y }],
    };
  }
  const dx = p.x - s.start.x;
  const dy = p.y - s.start.y;
  if (Math.hypot(dx, dy) < SLOP) return { state: { ...s, samples }, intents: [] };
  // The press became a drag: a single tap that was waiting for its second one stands alone now.
  const intents: Intent[] = s.pending ? [tapOf(s.pending)] : [];
  const timer = s.pending ? null : undefined;
  const mode = lock(s.target!, dx, dy);
  if (!mode) return { state: { ...s, phase: "ignored", samples, pending: null }, intents, timer };
  intents.push({ type: "drag", mode, dx: 0, dy: 0 });
  return { state: { ...s, phase: "dragging", mode, origin: p, samples, pending: null }, intents, timer };
}

function up(s: GestureState, i: PointerInput): GestureStep {
  const pointers = s.pointers.filter((id) => id !== i.id);
  if (s.phase === "blocked") return { state: { ...s, phase: pointers.length ? "blocked" : "idle", pointers }, intents: [] };
  if (i.id !== s.id) return { state: { ...s, pointers }, intents: [] };
  const p = sample(i);
  const idle: GestureState = { ...s, phase: "idle", mode: null, pointers };
  if (s.phase === "dragging") {
    const { vx, vy } = velocity(recent([...s.samples, p]));
    return {
      state: idle,
      intents: [{ type: "release", mode: s.mode!, dx: p.x - s.origin.x, dy: p.y - s.origin.y, vx, vy }],
    };
  }
  if (s.phase !== "pressed" || p.t - s.start.t > TAP_MS) return { state: idle, intents: [] };
  const tap: Tap = { ...p, kind: s.kind, target: s.target! };
  const { pending } = s;
  if (pending && Math.hypot(p.x - pending.x, p.y - pending.y) <= DOUBLE_TAP_PX && p.t - pending.t <= TAP_MS) {
    return {
      state: { ...idle, pending: null },
      intents: [{ type: "double-tap", x: p.x, y: p.y, target: pending.target }],
      timer: null,
    };
  }
  const intents: Intent[] = pending ? [tapOf(pending)] : [];
  if (waitsForSecondTap(tap)) return { state: { ...idle, pending: tap }, intents, timer: TAP_MS };
  intents.push(tapOf(tap));
  return { state: { ...idle, pending: null }, intents, timer: pending ? null : undefined };
}

function cancel(s: GestureState, i: PointerInput): GestureStep {
  const pointers = s.pointers.filter((id) => id !== i.id);
  if (s.phase === "blocked") return { state: { ...s, phase: pointers.length ? "blocked" : "idle", pointers }, intents: [] };
  if (i.id !== s.id) return { state: { ...s, pointers }, intents: [] };
  const intents: Intent[] = s.phase === "dragging" && s.mode ? [{ type: "abort", mode: s.mode }] : [];
  return { state: { ...s, phase: "idle", mode: null, pointers }, intents };
}

/** What a drag does, decided once when it passes the slop. Null: nothing (dragging up). */
function lock(target: Target, dx: number, dy: number): Mode | null {
  const horizontal = Math.abs(dx) > Math.abs(dy);
  if (target.zoomed) return horizontal && (dx < 0 ? target.atRight : target.atLeft) ? "swipe" : "pan";
  if (horizontal) return "swipe";
  return dy > 0 ? "dismiss" : null;
}

const waitsForSecondTap = (tap: Tap): boolean =>
  tap.kind !== "mouse" && tap.target.area === "media" && tap.target.type === "image" && tap.target.zoomable;

const tapOf = ({ x, y, kind, target }: Tap): Intent => ({ type: "tap", x, y, kind, target });

const sample = ({ x, y, t }: PointerInput): Sample => ({ x, y, t });

function recent(samples: Sample[]): Sample[] {
  const last = samples[samples.length - 1]!;
  return samples.filter((p) => last.t - p.t <= VELOCITY_MS);
}

function velocity(samples: Sample[]): { vx: number; vy: number } {
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const dt = last.t - first.t;
  return dt > 0 ? { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt } : { vx: 0, vy: 0 };
}
```

- [ ] **Step 4: Run the tests**

Run: `bun test ./test/unit`
Expected: PASS.

Run: `bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/gesture.ts test/unit/gesture.test.ts
git commit -m "Add the gesture state machine" -m "Pointer events go in, intents come out: tap, double tap, swipe, pan, drag down and abort. The 300 ms wait for a double tap happens only on zoomable photos and is a timer the caller runs, so the module stays pure."
```

---

### Task 6: The video state machine

**Files:**
- Create: `src/core/video.ts`, `test/unit/video.test.ts`

**Interfaces:**
- Produces, from `src/core/video.ts`:
  - `type VideoPhase = "idle" | "starting" | "playing" | "paused" | "suspended" | "error"`
  - `interface VideoState { phase: VideoPhase; muted: boolean; loading: boolean; retried: boolean }`, `const initialVideo: VideoState` (idle, muted)
  - `type VideoEvent`: `activate { saveData }`, `deactivate`, `toggle`, `toggle-mute`, `playing`, `pause`, `waiting`, `volume { muted }`, `rejected { error: string }` (the DOMException's name), `error`, `hidden`, `visible`
  - `type VideoEffect`: `load`, `play`, `pause`, `release`, `mute { muted }`
  - `interface VideoStep { state: VideoState; effects: VideoEffect[] }` and `video(state: VideoState, event: VideoEvent): VideoStep`

- [ ] **Step 1: Write the failing tests**

`test/unit/video.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { initialVideo, type VideoEvent, type VideoState, video } from "../../src/core/video";

const after = (events: VideoEvent[], from: VideoState = initialVideo): VideoState =>
  events.reduce((state, event) => video(state, event).state, from);
const started = (): VideoState => after([{ type: "activate", saveData: false }]);
const playing = (): VideoState => after([{ type: "activate", saveData: false }, { type: "playing" }]);

describe("starting", () => {
  test("activating loads and plays, muted", () => {
    expect(video(initialVideo, { type: "activate", saveData: false })).toEqual({
      state: { phase: "starting", muted: true, loading: true, retried: false },
      effects: [{ type: "load" }, { type: "play" }],
    });
  });

  test("with Save-Data it loads but waits, paused", () => {
    expect(video(initialVideo, { type: "activate", saveData: true })).toEqual({
      state: { phase: "paused", muted: true, loading: false, retried: false },
      effects: [{ type: "load" }],
    });
  });

  test("the playing event makes it playing", () => {
    expect(playing()).toEqual({ phase: "playing", muted: true, loading: false, retried: false });
  });
});

describe("playing and pausing", () => {
  test("toggle pauses a playing video and plays a paused one", () => {
    const paused = video(playing(), { type: "toggle" });
    expect(paused).toEqual({ state: { ...playing(), phase: "paused" }, effects: [{ type: "pause" }] });
    expect(video(paused.state, { type: "toggle" })).toEqual({
      state: { ...paused.state, phase: "starting" },
      effects: [{ type: "play" }],
    });
  });

  test("pause events from elsewhere, such as a custom player, are followed", () => {
    expect(video(playing(), { type: "pause" }).state.phase).toBe("paused");
  });

  test("waiting shows loading until it plays again", () => {
    const waiting = video(playing(), { type: "waiting" }).state;
    expect(waiting.loading).toBe(true);
    expect(video(waiting, { type: "playing" }).state.loading).toBe(false);
  });
});

describe("sound", () => {
  test("toggle-mute flips it", () => {
    expect(video(playing(), { type: "toggle-mute" })).toEqual({
      state: { ...playing(), muted: false },
      effects: [{ type: "mute", muted: false }],
    });
  });

  test("volume events from elsewhere are followed", () => {
    expect(video(playing(), { type: "volume", muted: false }).state.muted).toBe(false);
  });
});

describe("blocked starts", () => {
  test("blocked with sound: mute and retry once", () => {
    const loud: VideoState = { ...started(), muted: false };
    const retry = video(loud, { type: "rejected", error: "NotAllowedError" });
    expect(retry.effects).toEqual([{ type: "mute", muted: true }, { type: "play" }]);
    expect(retry.state).toMatchObject({ phase: "starting", muted: true, retried: true });
    expect(video(retry.state, { type: "rejected", error: "NotAllowedError" }).state.phase).toBe("paused");
  });

  test("blocked while muted (Low Power Mode): paused until a tap", () => {
    expect(video(started(), { type: "rejected", error: "NotAllowedError" })).toEqual({
      state: { ...started(), phase: "paused", loading: false },
      effects: [],
    });
  });

  test("AbortError is ignored", () => {
    expect(video(started(), { type: "rejected", error: "AbortError" })).toEqual({ state: started(), effects: [] });
  });

  test("other play() errors and media errors end in error", () => {
    expect(video(started(), { type: "rejected", error: "NotSupportedError" }).state.phase).toBe("error");
    expect(video(playing(), { type: "error" }).state.phase).toBe("error");
  });
});

describe("page visibility and leaving", () => {
  test("a hidden page suspends a playing video, a visible one resumes it", () => {
    const hidden = video(playing(), { type: "hidden" });
    expect(hidden).toEqual({ state: { ...playing(), phase: "suspended" }, effects: [{ type: "pause" }] });
    expect(video(hidden.state, { type: "pause" }).state.phase).toBe("suspended");
    expect(video(hidden.state, { type: "visible" })).toEqual({
      state: { ...playing(), phase: "starting" },
      effects: [{ type: "play" }],
    });
  });

  test("a paused video stays paused when the page comes back", () => {
    const paused = video(playing(), { type: "toggle" }).state;
    expect(after([{ type: "hidden" }, { type: "visible" }], paused).phase).toBe("paused");
  });

  test("deactivate releases it, and late media events change nothing", () => {
    const idle = video(playing(), { type: "deactivate" });
    expect(idle.effects).toEqual([{ type: "release" }]);
    expect(idle.state.phase).toBe("idle");
    expect(video(idle.state, { type: "playing" }).state).toEqual(idle.state);
    expect(video(idle.state, { type: "error" }).state).toEqual(idle.state);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun test ./test/unit/video.test.ts`
Expected: FAIL, module `../../src/core/video` not found.

- [ ] **Step 3: Implement `src/core/video.ts`**

```ts
// The video state machine. The media element's own events are the source of truth, so a custom player that
// calls play() or pause() itself stays in sync. Effects tell the DOM shell what to do.

export type VideoPhase = "idle" | "starting" | "playing" | "paused" | "suspended" | "error";

export interface VideoState {
  phase: VideoPhase;
  muted: boolean;
  /** Buffering: waiting for data. */
  loading: boolean;
  /** A start with sound was blocked once and retried muted. */
  retried: boolean;
}

export type VideoEvent =
  | { type: "activate"; saveData: boolean }
  | { type: "deactivate" }
  | { type: "toggle" }
  | { type: "toggle-mute" }
  | { type: "playing" }
  | { type: "pause" }
  | { type: "waiting" }
  | { type: "volume"; muted: boolean }
  // play() was rejected; error is the DOMException's name.
  | { type: "rejected"; error: string }
  | { type: "error" }
  | { type: "hidden" }
  | { type: "visible" };

export type VideoEffect =
  | { type: "load" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "release" }
  | { type: "mute"; muted: boolean };

export interface VideoStep {
  state: VideoState;
  effects: VideoEffect[];
}

export const initialVideo: VideoState = { phase: "idle", muted: true, loading: false, retried: false };

const just = (state: VideoState): VideoStep => ({ state, effects: [] });
const running = (s: VideoState): boolean => s.phase === "playing" || s.phase === "starting";

export function video(s: VideoState, e: VideoEvent): VideoStep {
  switch (e.type) {
    case "activate":
      return e.saveData
        ? { state: { ...s, phase: "paused", loading: false, retried: false }, effects: [{ type: "load" }] }
        : {
            state: { ...s, phase: "starting", loading: true, retried: false },
            effects: [{ type: "load" }, { type: "play" }],
          };
    case "deactivate":
      return { state: { ...s, phase: "idle", loading: false }, effects: [{ type: "release" }] };
    case "toggle":
      if (running(s)) return { state: { ...s, phase: "paused", loading: false }, effects: [{ type: "pause" }] };
      if (s.phase === "paused") return { state: { ...s, phase: "starting" }, effects: [{ type: "play" }] };
      return just(s);
    case "toggle-mute":
      return { state: { ...s, muted: !s.muted }, effects: [{ type: "mute", muted: !s.muted }] };
    case "playing":
      return just(s.phase === "idle" ? s : { ...s, phase: "playing", loading: false });
    case "pause":
      return just(running(s) ? { ...s, phase: "paused", loading: false } : s);
    case "waiting":
      return just(s.phase === "idle" ? s : { ...s, loading: true });
    case "volume":
      return just({ ...s, muted: e.muted });
    case "rejected":
      return rejected(s, e.error);
    case "error":
      return just(s.phase === "idle" ? s : { ...s, phase: "error", loading: false });
    case "hidden":
      return running(s) ? { state: { ...s, phase: "suspended" }, effects: [{ type: "pause" }] } : just(s);
    case "visible":
      return s.phase === "suspended" ? { state: { ...s, phase: "starting" }, effects: [{ type: "play" }] } : just(s);
  }
}

function rejected(s: VideoState, error: string): VideoStep {
  // AbortError: a newer pause() or load() interrupted play(); nothing to do.
  if (error === "AbortError" || s.phase === "idle") return just(s);
  if (error !== "NotAllowedError") return just({ ...s, phase: "error", loading: false });
  // Blocked with sound: mute and try once more. Blocked while muted (Low Power Mode): wait for a tap.
  if (!s.muted && !s.retried) {
    return {
      state: { ...s, phase: "starting", muted: true, retried: true },
      effects: [{ type: "mute", muted: true }, { type: "play" }],
    };
  }
  return just({ ...s, phase: "paused", loading: false });
}
```

- [ ] **Step 4: Run the tests**

Run: `bun test ./test/unit`
Expected: PASS, every core module.

Run: `bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/video.ts test/unit/video.test.ts
git commit -m "Add the video state machine" -m "Media events drive the state, so a custom player that calls play() itself stays in sync. A start blocked with sound retries once muted; a start blocked while muted (Low Power Mode) waits paused for a tap."
```

---

### Task 7: Browser test harness and the first shell: open, fit, load, close

**Files:**
- Create: `test/browser/media/*` (generated), `test/browser/fixture.html`, `test/browser/fixture.ts`, `test/browser/globals.d.ts`, `test/browser/helpers.ts`, `test/browser/open-close.spec.ts`
- Create: `scripts/serve.ts`, `playwright.config.ts`
- Create: `src/dialog-lightbox.css`, `src/index.ts`, `src/dom/animate.ts`, `src/dom/links.ts`, `src/dom/slides.ts`, `src/dom/session.ts`, `src/dom/controls.ts`, `src/dom/lightbox.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `FIT_VIEW`, `fit`, `viewRect`, `Rect`, `Size`, `View`, `Insets` (geometry); `step`, `neighbours` (navigation); `resolveSize`, `slideId` (slide); `GestureState`, `initialGesture` (gesture).
- Produces:
  - `src/dom/animate.ts`: `DURATION = 300`, `EASE`, `play(element, keyframes, duration, easing = "linear"): Promise<void>`, `stop(element): DOMMatrix`, `placeAt(rect: Rect, size: Size): string`, `clipAt(insets: Insets, rect: Rect, size: Size): string`
  - `src/dom/links.ts`: `interface SlideData { index; id; type; link; thumb; src; srcset; aspect: Size | null; native: number | undefined; audio: boolean }`, `readSlide(link, index, galleryId): SlideData`, `readSlides(gallery, galleryId): SlideData[]`
  - `src/dom/slides.ts`: `interface SlideEl { data; el; media; large; ready; status: "loading" | "ready" | "error"; base: number }`, `FILL`, `createSlide(data)`, `image(src, alt, srcset?, sizes?)`, `loadLarge(slide, sizes): Promise<void>`
  - `src/dom/session.ts`: `GAP = 0.1`, `interface Session` (fields listed in the code), `createSession(slides, index, loop, viewport)`, `current(s)`, `areaOf(viewport, size): Rect`, `measure(s, viewport)`, `fitOf(s, slide): Rect | null`, `wrapperSize(slide, fitRect): Size`, `setSlots(s, index)`, `place(s)`
  - `src/dom/controls.ts`: `type Controls = Record<"close" | "prev" | "next" | "zoom" | "counter" | "play" | "mute" | "progress", HTMLElement[]>`, `interface UiState`, `findControls(dialog)`, `render(dialog, controls, ui)`, `clear(dialog)`
  - `src/dom/lightbox.ts` and `src/index.ts`: `lightbox(options: LightboxOptions): Lightbox` with `open`, `close`, `current`, `count`, `on`, `destroy` (later tasks add `goTo`, `next`, `prev`, `video` and the `history` option); types `Lightbox`, `LightboxOptions`, `LightboxEvent`, `Slide`
  - Test helpers in `test/browser/helpers.ts`: `test` (with a `fixture` page fixture that fails on page errors), `expect`, `openAt(page, galleryId, index)`, `drag(page, from, to, ms?, kind?)`, `tap(page, at, kind?)`

- [ ] **Step 1: Generate the test media**

Photos are SVGs with fixed sizes (a thumbnail has the same picture at a smaller size). The clips are three seconds of a test pattern, with and without a tone, as H.264 for WebKit and VP9 for Playwright's Chromium, which can't play H.264.

```bash
mkdir -p test/browser/media
svg() { # name width height viewBoxWidth viewBoxHeight color label
  printf '<svg xmlns="http://www.w3.org/2000/svg" width="%s" height="%s" viewBox="0 0 %s %s"><rect width="%s" height="%s" fill="%s"/><text x="%s" y="%s" font-size="%s" font-family="sans-serif" text-anchor="middle" fill="#fff">%s</text></svg>\n' \
    "$2" "$3" "$4" "$5" "$4" "$5" "$6" "$(($4 / 2))" "$(($5 / 2))" "$(($5 / 5))" "$7" > "test/browser/media/$1.svg"
}
svg wide 3200 800 3200 800 '#3b6ea5' wide
svg wide-thumb 400 100 3200 800 '#3b6ea5' wide
svg tall 600 900 600 900 '#3a7d44' tall
svg tall-thumb 300 450 600 900 '#3a7d44' tall
svg small 300 200 300 200 '#b5651d' small
svg small-thumb 150 100 300 200 '#b5651d' small
svg square 1000 1000 1000 1000 '#6b4c9a' square
svg square-thumb 200 200 1000 1000 '#6b4c9a' square
svg poster 360 640 360 640 '#222222' clip
for codec in mp4 webm; do
  if [ "$codec" = mp4 ]; then video="-c:v libx264 -pix_fmt yuv420p -movflags +faststart"; audio="-c:a aac"; else video="-c:v libvpx-vp9 -b:v 300k"; audio="-c:a libopus"; fi
  ffmpeg -v error -y -f lavfi -i testsrc2=size=360x640:rate=30:duration=3 -f lavfi -i sine=frequency=440:duration=3 $video $audio -shortest "test/browser/media/clip.$codec"
  ffmpeg -v error -y -f lavfi -i testsrc2=size=360x640:rate=30:duration=3 $video -an "test/browser/media/silent.$codec"
done
ls -la test/browser/media
```

Expected: 9 SVG files and `clip.mp4`, `clip.webm`, `silent.mp4`, `silent.webm`, each under 300 KB.

- [ ] **Step 2: Write `test/browser/fixture.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>dialog-lightbox test fixture</title>
    <link rel="stylesheet" href="../../src/dialog-lightbox.css" />
    <style>
      body { margin: 0; font: 14px system-ui, sans-serif; }
      .strip { display: flex; gap: 8px; overflow-x: auto; padding: 8px; }
      .strip img { display: block; width: 150px; height: 100px; object-fit: cover; }
      .spacer { height: 120vh; }
      dialog { background: transparent; color: #fff; }
      dialog::backdrop { background: rgb(0 0 0 / var(--dlb-opacity)); }
      [data-dlb-viewport] { padding: 40px 0 60px; }
      .top, .bottom { position: absolute; inset-inline: 0; display: flex; justify-content: space-between; height: 36px; }
      .top { top: 0; }
      .bottom { bottom: 0; }
      [data-dlb-ui-hidden] .top { visibility: hidden; }
    </style>
  </head>
  <body>
    <div class="strip" id="one">
      <a href="media/wide.svg" data-dlb-width="3200" data-dlb-height="800" data-dlb-id="wide"><img src="media/wide-thumb.svg" alt="Wide" /></a>
      <a href="media/tall.svg" data-dlb-srcset="media/tall.svg 600w"><img src="media/tall-thumb.svg" alt="Tall" /></a>
      <a href="media/small.svg" data-dlb-width="300" data-dlb-height="200"><img src="media/small-thumb.svg" alt="Small" /></a>
      <a href="media/clip.mp4" data-dlb-type="video" data-dlb-width="360" data-dlb-height="640"><img src="media/poster.svg" alt="Clip" /></a>
      <a href="media/clip.mp4" data-dlb-type="video" data-dlb-width="360" data-dlb-height="640"><img src="media/poster.svg" alt="Clip again" /></a>
      <a href="media/silent.mp4" data-dlb-type="video" data-dlb-width="360" data-dlb-height="640" data-dlb-audio="false"><img src="media/poster.svg" alt="Silent clip" /></a>
      <a href="media/missing.svg" data-dlb-width="800" data-dlb-height="600"><img src="media/small-thumb.svg" alt="Missing" /></a>
    </div>
    <div class="spacer"></div>
    <div class="strip" id="two" data-loop="true">
      <a href="media/square.svg"><img src="media/square-thumb.svg" alt="Square" /></a>
      <a href="media/wide.svg" data-dlb-width="3200" data-dlb-height="800"><img src="media/wide-thumb.svg" alt="Wide again" /></a>
      <a href="media/tall.svg" data-dlb-width="600" data-dlb-height="900"><img src="media/tall-thumb.svg" alt="Tall again" /></a>
    </div>
    <p id="three" data-history="false"><a href="media/square.svg">A text link</a></p>
    <dialog aria-label="Photo viewer">
      <div data-dlb-viewport></div>
      <div class="top">
        <span data-dlb-counter></span>
        <button type="button" data-dlb-zoom>Zoom</button>
        <button type="button" data-dlb-play>Play</button>
        <button type="button" data-dlb-mute>Sound</button>
        <button type="button" data-dlb-close>Close</button>
      </div>
      <div class="bottom">
        <button type="button" data-dlb-prev>Previous</button>
        <span data-dlb-progress></span>
        <button type="button" data-dlb-next>Next</button>
      </div>
    </dialog>
    <script type="module" src="./fixture.ts"></script>
  </body>
</html>
```

Gallery `#one` covers the cases the tests need: attributes (wide), no attributes with a srcset (tall), too small to zoom (small), two clips with sound, a clip without audio, and a missing file. `#two` loops. `#three` has a single text link without a thumbnail.

- [ ] **Step 3: Write `test/browser/fixture.ts` and `test/browser/globals.d.ts`**

`test/browser/fixture.ts`:

```ts
import { type Lightbox, lightbox } from "../../src/index";

// Playwright's Chromium can't play H.264, so it gets the WebM copies of the test clips.
if (!document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E"')) {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href$=".mp4"]')) {
    link.href = link.href.replace(/\.mp4$/, ".webm");
  }
}

const dialog = document.querySelector("dialog")!;
const log: string[] = [];
const boxes: Lightbox[] = [];
for (const id of ["one", "two", "three"]) {
  const gallery = document.getElementById(id)!;
  const box = lightbox({ gallery, dialog, loop: gallery.dataset.loop === "true" });
  for (const type of ["open", "change", "close"] as const) box.on(type, (slide) => log.push(`${type}:${slide.id}`));
  boxes.push(box);
}
Object.assign(window, { boxes, log, lightbox });
```

`test/browser/globals.d.ts`:

```ts
import type { Lightbox, LightboxOptions } from "../../src/index";

declare global {
  interface Window {
    /** "open:<id>", "change:<id>" and "close:<id>" for every event, in order. */
    log: string[];
    /** The lightboxes of the galleries #one, #two and #three. */
    boxes: Lightbox[];
    lightbox: (options: LightboxOptions) => Lightbox;
  }
}
```

- [ ] **Step 4: Write `test/browser/helpers.ts`**

```ts
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
        const init = { pointerId: 7, pointerType: kind, isPrimary: true, clientX: x, clientY: y, button: 0, buttons };
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
```

- [ ] **Step 5: Write the dev server, the Playwright config and the scripts**

`scripts/serve.ts`:

```ts
// Dev server for the browser tests (and later the demo). Bun bundles each HTML page with its TypeScript and
// CSS; every other file comes from the repository, with byte ranges, which Safari needs to play video.
import fixture from "../test/browser/fixture.html";

const flag = process.argv.indexOf("--port");
const port = flag > 0 ? Number(process.argv[flag + 1]) : 3000;
const root = `${import.meta.dir}/..`;

const server = Bun.serve({
  hostname: "0.0.0.0",
  port,
  development: { hmr: false },
  routes: { "/test/browser/": fixture },
  async fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    const file = Bun.file(`${root}${path}`);
    if (path.includes("..") || !(await file.exists())) return new Response("Not found", { status: 404 });
    const range = /bytes=(\d+)-(\d*)/.exec(request.headers.get("range") ?? "");
    if (!range) return new Response(file, { headers: { "accept-ranges": "bytes" } });
    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : file.size - 1;
    return new Response(file.slice(start, end + 1), {
      status: 206,
      headers: {
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${file.size}`,
        "content-type": file.type,
      },
    });
  },
});

console.log(`Test fixture: http://localhost:${server.port}/test/browser/`);
```

If `tsc` reports that `../test/browser/fixture.html` has no type declarations, add a file `scripts/html.d.ts` with `declare module "*.html" { const bundle: import("bun").HTMLBundle; export default bundle; }`.

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3123",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    // Most tests check end states; the animation tests switch motion back on.
    reducedMotion: "reduce",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "bun scripts/serve.ts --port 3123",
    url: "http://localhost:3123/test/browser/",
    reuseExistingServer: !process.env.CI,
  },
});
```

In `package.json`, replace the `scripts` block with:

```json
  "scripts": {
    "check": "biome check . && tsc",
    "test": "bun test ./test/unit",
    "test:browser": "bun --bun playwright test",
    "dev": "bun scripts/serve.ts"
  },
```

Install the browsers:

```bash
bunx --bun playwright install chromium webkit
```

Expected: both browsers download into `~/Library/Caches/ms-playwright`.

- [ ] **Step 6: Write the failing browser tests**

`test/browser/open-close.spec.ts`:

```ts
import { expect, openAt, test } from "./helpers";

test("a click on a thumbnail opens its slide", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-type", "image");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 7");
  expect(await page.evaluate(() => window.log)).toEqual(["open:wide", "change:wide"]);
});

test("the thumbnail shows at once and the large image lies over it once decoded", async ({ fixture: page }) => {
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
```

- [ ] **Step 7: Run them and see them fail**

Run: `bun run test:browser`
Expected: FAIL. The server can't bundle `fixture.ts` because `../../src/index` doesn't exist, so every test fails while opening the page or finding the dialog.

- [ ] **Step 8: Write `src/dialog-lightbox.css`**

```css
/* dialog-lightbox: layout only. Colors, fonts and buttons belong to the page. */
@property --dlb-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 1;
}

@layer dialog-lightbox {
  /* Scroll lock: a modal dialog alone doesn't stop the page scrolling on iOS. */
  html:has(dialog[data-dlb][open]) {
    overflow: hidden;
    scrollbar-gutter: stable;
  }

  dialog[data-dlb] {
    inset: 0;
    width: 100%;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    overscroll-behavior: contain;
  }

  [data-dlb-viewport] {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  [data-dlb-viewport]:focus {
    outline: none;
  }

  [data-dlb-slide] {
    position: absolute;
    inset: 0;
  }
}
```

The viewport gets focus on open (so keys reach the box and not the first button); it is no control, so it shows no outline.

- [ ] **Step 9: Write `src/dom/animate.ts`**

```ts
// Helpers around the Web Animations API. The pattern everywhere: set the final state inline first, then
// animate from the old state to it, so a cancelled or skipped animation still leaves the right state.
import type { Insets, Rect, Size } from "../core/geometry";

export const DURATION = 300;
export const EASE = "cubic-bezier(.4, 0, .22, 1)";

const reducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Runs an animation and resolves when it ends or is cancelled. With reduced motion it does nothing. */
export async function play(element: Element, keyframes: Keyframe[], duration: number, easing = "linear"): Promise<void> {
  if (duration <= 0 || reducedMotion()) return;
  try {
    await element.animate(keyframes, { duration, easing }).finished;
  } catch {
    // Cancelled: whoever cancelled it has set the state.
  }
}

/** Cancels the element's animations and returns its transform as it was on screen. */
export function stop(element: Element): DOMMatrix {
  const matrix = new DOMMatrix(getComputedStyle(element).transform);
  for (const animation of element.getAnimations()) animation.cancel();
  return matrix;
}

/** The transform that puts an element of `size` (transform origin top left) onto `rect`. */
export const placeAt = (rect: Rect, size: Size): string =>
  `translate(${rect.x}px, ${rect.y}px) scale(${rect.width / size.width})`;

/** A clip-path for `insets` given in screen pixels on `rect`, in the element's own pixels. */
export function clipAt(insets: Insets, rect: Rect, size: Size): string {
  const k = size.width / rect.width;
  return `inset(${insets.top * k}px ${insets.right * k}px ${insets.bottom * k}px ${insets.left * k}px)`;
}
```

- [ ] **Step 10: Write `src/dom/links.ts`**

```ts
// Slide data from a gallery's links: what to load, how big it is, its id.
import type { Size } from "../core/geometry";
import { resolveSize, slideId } from "../core/slide";

export interface SlideData {
  index: number;
  id: string;
  type: "image" | "video";
  link: HTMLAnchorElement;
  thumb: HTMLImageElement | null;
  src: string;
  srcset: string | undefined;
  /** Aspect ratio as a size; null until the large image has loaded when nothing else tells it. */
  aspect: Size | null;
  /** Native width in CSS pixels, for zooming. */
  native: number | undefined;
  audio: boolean;
}

export function readSlide(link: HTMLAnchorElement, index: number, galleryId: string): SlideData {
  const { dataset } = link;
  const thumb = link.querySelector("img");
  const natural = thumb?.naturalWidth ? { width: thumb.naturalWidth, height: thumb.naturalHeight } : null;
  return {
    index,
    id: slideId(dataset.dlbId, galleryId, index),
    type: dataset.dlbType === "video" ? "video" : "image",
    link,
    thumb,
    src: link.href,
    srcset: dataset.dlbSrcset,
    ...resolveSize(Number(dataset.dlbWidth), Number(dataset.dlbHeight), natural, dataset.dlbSrcset),
    audio: dataset.dlbAudio !== "false",
  };
}

export const readSlides = (gallery: HTMLElement, galleryId: string): SlideData[] =>
  [...gallery.querySelectorAll<HTMLAnchorElement>("a[href]")].map((link, index) => readSlide(link, index, galleryId));
```

- [ ] **Step 11: Write `src/dom/slides.ts`**

```ts
// Slide elements. Each holds a wrapper for its media: the thumbnail's image as a placeholder and, once
// decoded, the large image on top. session.ts sizes and places the wrapper.
import type { SlideData } from "./links";

export interface SlideEl {
  data: SlideData;
  /** [data-dlb-slide], moved sideways in the strip. */
  el: HTMLElement;
  /** The wrapper that is sized and transformed. */
  media: HTMLElement;
  large: HTMLImageElement | null;
  /** Loading of the large image, started once. */
  ready: Promise<void> | null;
  status: "loading" | "ready" | "error";
  /** The zoom the wrapper was last sized for; its transform scales relative to it. */
  base: number;
}

/** Inline styles for media in the wrapper: fill it, whatever the page's CSS reset says. */
export const FILL = "position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;display:block";

export function createSlide(data: SlideData): SlideEl {
  const el = document.createElement("div");
  el.dataset.dlbSlide = "";
  el.style.cssText = "position:absolute;inset:0";
  const media = document.createElement("div");
  media.style.cssText = "position:absolute;left:0;top:0;transform-origin:0 0";
  if (data.thumb) {
    // The thumbnail is loaded already, so it shows at once. For a video it is the poster.
    const alt = data.type === "video" ? data.thumb.alt : "";
    media.append(image(data.thumb.currentSrc || data.thumb.src, alt));
  }
  el.append(media);
  return { data, el, media, large: null, ready: null, status: data.type === "video" ? "ready" : "loading", base: 1 };
}

export function image(src: string, alt: string, srcset?: string, sizes?: number): HTMLImageElement {
  const img = new Image();
  img.alt = alt;
  img.draggable = false;
  img.style.cssText = FILL;
  if (srcset) {
    img.sizes = `${Math.round(sizes ?? innerWidth)}px`;
    img.srcset = srcset;
  }
  img.src = src;
  return img;
}

/** Loads and decodes the large image once, then lays it over the placeholder. Never rejects. */
export function loadLarge(slide: SlideEl, sizes: number): Promise<void> {
  slide.ready ??= decode(slide, sizes);
  return slide.ready;
}

async function decode(slide: SlideEl, sizes: number): Promise<void> {
  const { data } = slide;
  if (data.type === "video") return;
  const alt = data.thumb?.alt ?? data.link.textContent?.trim() ?? "";
  const img = image(data.src, alt, data.srcset, sizes);
  try {
    await img.decode();
    data.aspect ??= { width: img.naturalWidth, height: img.naturalHeight };
    // With a srcset, naturalWidth depends on the chosen file; the native width came from the srcset then.
    if (!data.srcset) data.native ??= img.naturalWidth;
    slide.large = img;
    slide.media.append(img);
    slide.status = "ready";
  } catch {
    slide.status = "error";
  }
}
```

- [ ] **Step 12: Write `src/dom/session.ts`**

```ts
// One open lightbox: its slides, the three slide elements in the strip, and where everything is.
// place() writes every position from this state; the other dom/ modules change the state and call it.
import { FIT_VIEW, fit, type Rect, type Size, type View, viewRect } from "../core/geometry";
import { type GestureState, initialGesture } from "../core/gesture";
import { neighbours } from "../core/navigation";
import { placeAt } from "./animate";
import type { SlideData } from "./links";
import { createSlide, type SlideEl } from "./slides";

/** Space between slides, as a share of the viewport width. */
export const GAP = 0.1;

export interface Session {
  slides: SlideData[];
  loop: boolean;
  index: number;
  /** Previous, current and next slide element. */
  slots: [SlideEl | null, SlideEl, SlideEl | null];
  /** Holds the slide elements and moves sideways. */
  strip: HTMLElement;
  /** The strip's offset: 0 when the current slide is in place. */
  stripX: number;
  /** The current slide's media relative to their fit rectangle. */
  view: View;
  /** Strip and view when the current drag began. */
  from: { stripX: number; view: View };
  gesture: GestureState;
  timer: ReturnType<typeof setTimeout> | undefined;
  frame: number;
  /** The viewport's corner on screen, its size, and its content box, where photos fit. */
  origin: { x: number; y: number };
  size: Size;
  area: Rect;
  uiHidden: boolean;
  /** The opening animation runs; pointer input and navigation wait. */
  busy: boolean;
  closing: boolean;
  /** Aborting it removes every listener of this session. */
  abort: AbortController;
}

export function createSession(slides: SlideData[], index: number, loop: boolean, viewport: HTMLElement): Session {
  const strip = document.createElement("div");
  strip.style.cssText = "position:absolute;inset:0";
  viewport.append(strip);
  const session: Session = {
    slides,
    loop,
    index,
    slots: [null, createSlide(slides[index]!), null],
    strip,
    stripX: 0,
    view: FIT_VIEW,
    from: { stripX: 0, view: FIT_VIEW },
    gesture: initialGesture,
    timer: undefined,
    frame: 0,
    origin: { x: 0, y: 0 },
    size: { width: 0, height: 0 },
    area: { x: 0, y: 0, width: 0, height: 0 },
    uiHidden: false,
    busy: false,
    closing: false,
    abort: new AbortController(),
  };
  setSlots(session, index);
  measure(session, viewport);
  return session;
}

export const current = (s: Session): SlideEl => s.slots[1];

/** The part of `size` inside the viewport's CSS padding: where photos fit. */
export function areaOf(viewport: HTMLElement, size: Size): Rect {
  const style = getComputedStyle(viewport);
  const px = (value: string): number => Number.parseFloat(value) || 0;
  const left = px(style.paddingLeft);
  const top = px(style.paddingTop);
  return {
    x: left,
    y: top,
    width: size.width - left - px(style.paddingRight),
    height: size.height - top - px(style.paddingBottom),
  };
}

export function measure(s: Session, viewport: HTMLElement): void {
  const box = viewport.getBoundingClientRect();
  s.origin = { x: box.left, y: box.top };
  s.size = { width: box.width, height: box.height };
  s.area = areaOf(viewport, s.size);
}

export const fitOf = (s: Session, slide: SlideEl): Rect | null =>
  slide.data.aspect ? fit(slide.data.aspect, s.area) : null;

/** The wrapper's own size: the fit size at the zoom it was last sized for. */
export const wrapperSize = (slide: SlideEl, f: Rect): Size => ({
  width: f.width * slide.base,
  height: f.height * slide.base,
});

/** Makes `index` current: keeps slide elements that stay, creates new neighbours, removes the rest. */
export function setSlots(s: Session, index: number): void {
  const old = s.slots.filter((slide): slide is SlideEl => slide !== null);
  const pick = (i: number): SlideEl => old.find((slide) => slide.data.index === i) ?? createSlide(s.slides[i]!);
  const [prev, , next] = neighbours(index, s.slides.length, s.loop);
  s.index = index;
  s.slots = [prev === null ? null : pick(prev), pick(index), next === null ? null : pick(next)];
  for (const slide of old) if (!s.slots.includes(slide)) slide.el.remove();
  for (const slide of s.slots) if (slide && slide.el.parentNode !== s.strip) s.strip.append(slide.el);
}

/** Writes every position: the strip, each slide's place in it, and each slide's media. */
export function place(s: Session): void {
  const gap = s.size.width * (1 + GAP);
  s.strip.style.transform = `translateX(${s.stripX}px)`;
  for (const [i, slide] of s.slots.entries()) {
    if (!slide) continue;
    const isCurrent = i === 1;
    slide.el.style.transform = `translateX(${(i - 1) * gap}px)`;
    slide.el.toggleAttribute("data-dlb-current", isCurrent);
    slide.el.setAttribute("aria-hidden", String(!isCurrent));
    const f = fitOf(s, slide);
    slide.media.style.visibility = f ? "" : "hidden";
    if (!f) continue;
    const size = wrapperSize(slide, f);
    slide.media.style.width = `${size.width}px`;
    slide.media.style.height = `${size.height}px`;
    slide.media.style.transform = placeAt(viewRect(f, isCurrent ? s.view : FIT_VIEW), size);
  }
}
```

- [ ] **Step 13: Write `src/dom/controls.ts`**

```ts
// The page's own buttons and outputs in the dialog, found by data-dlb-* attributes, and the state
// attributes the page styles with.

const NAMES = ["close", "prev", "next", "zoom", "counter", "play", "mute", "progress"] as const;

export type Controls = Record<(typeof NAMES)[number], HTMLElement[]>;

/** What the dialog shows about the current slide. */
export interface UiState {
  type: "image" | "video";
  index: number;
  count: number;
  first: boolean;
  last: boolean;
  loading: boolean;
  error: boolean;
  zoomable: boolean;
  zoomed: boolean;
  uiHidden: boolean;
  paused: boolean;
  muted: boolean;
  noaudio: boolean;
}

export function findControls(dialog: HTMLDialogElement): Controls {
  const controls = {} as Controls;
  for (const name of NAMES) controls[name] = [...dialog.querySelectorAll<HTMLElement>(`[data-dlb-${name}]`)];
  return controls;
}

export function render(dialog: HTMLDialogElement, controls: Controls, ui: UiState): void {
  dialog.dataset.dlbType = ui.type;
  const flags: Record<string, boolean> = {
    first: ui.first,
    last: ui.last,
    loading: ui.loading,
    error: ui.error,
    zoomable: ui.zoomable,
    zoomed: ui.zoomed,
    "ui-hidden": ui.uiHidden,
    paused: ui.paused,
    muted: ui.muted,
    noaudio: ui.noaudio,
  };
  for (const [name, on] of Object.entries(flags)) dialog.toggleAttribute(`data-dlb-${name}`, on);
  for (const counter of controls.counter) counter.textContent = `${ui.index + 1} / ${ui.count}`;
  disable(controls.prev, ui.first);
  disable(controls.next, ui.last);
  disable(controls.zoom, !ui.zoomable);
  disable(controls.mute, ui.noaudio);
  press(controls.zoom, ui.zoomed);
  press(controls.play, !ui.paused);
  press(controls.mute, ui.muted);
}

/** Removes the state attributes when the box closes; `data-dlb` itself stays. */
export function clear(dialog: HTMLDialogElement): void {
  for (const name of dialog.getAttributeNames()) if (name.startsWith("data-dlb-")) dialog.removeAttribute(name);
}

function disable(elements: HTMLElement[], disabled: boolean): void {
  for (const element of elements) element.toggleAttribute("disabled", disabled);
}

function press(elements: HTMLElement[], pressed: boolean): void {
  for (const element of elements) element.setAttribute("aria-pressed", String(pressed));
}
```

- [ ] **Step 14: Write `src/dom/lightbox.ts` and `src/index.ts`**

`src/dom/lightbox.ts`:

```ts
// lightbox(): wires a gallery of links to a <dialog>. Each opening is a session (session.ts) that the other
// dom/ modules work on; closing drops it and removes its listeners with one abort() call.
import { FIT_VIEW } from "../core/geometry";
import { step } from "../core/navigation";
import { clear, findControls, render } from "./controls";
import { readSlides, type SlideData } from "./links";
import { createSession, current, fitOf, measure, place, type Session } from "./session";
import { loadLarge, type SlideEl } from "./slides";

export interface LightboxOptions {
  gallery: HTMLElement;
  dialog: HTMLDialogElement;
  loop?: boolean;
}

export interface Slide {
  index: number;
  id: string;
  type: "image" | "video";
  link: HTMLAnchorElement;
}

export type LightboxEvent = "open" | "change" | "close";

export interface Lightbox {
  open(index?: number): void;
  close(): void;
  readonly current: Slide | null;
  readonly count: number;
  on(type: LightboxEvent, handler: (slide: Slide) => void): () => void;
  destroy(): void;
}

let instances = 0;

export function lightbox(options: LightboxOptions): Lightbox {
  const { gallery, dialog, loop = false } = options;
  const viewport = dialog.querySelector<HTMLElement>("[data-dlb-viewport]");
  if (!viewport) throw new Error("dialog-lightbox: the dialog has no [data-dlb-viewport] element");
  dialog.setAttribute("data-dlb", "");
  // The viewport takes focus on open, so keys reach the box and not the dialog's first button.
  viewport.tabIndex = -1;
  const galleryId = gallery.id || `g${++instances}`;
  const controls = findControls(dialog);
  const life = new AbortController();
  const handlers: Record<LightboxEvent, Set<(slide: Slide) => void>> = {
    open: new Set(),
    change: new Set(),
    close: new Set(),
  };
  let s: Session | null = null;

  const links = (): HTMLAnchorElement[] => [...gallery.querySelectorAll<HTMLAnchorElement>("a[href]")];
  const toSlide = ({ index, id, type, link }: SlideData): Slide => ({ index, id, type, link });
  const emit = (event: LightboxEvent, data: SlideData): void => {
    for (const handler of handlers[event]) handler(toSlide(data));
  };

  /** Writes the state attributes and the buttons' state for the current slide. */
  function sync(): void {
    if (!s) return;
    const slide = current(s);
    render(dialog, controls, {
      type: slide.data.type,
      index: s.index,
      count: s.slides.length,
      first: step(s.index, -1, s.slides.length, loop) === null,
      last: step(s.index, 1, s.slides.length, loop) === null,
      loading: slide.status === "loading",
      error: slide.status === "error",
      zoomable: false,
      zoomed: false,
      uiHidden: s.uiHidden,
      paused: false,
      muted: false,
      noaudio: false,
    });
  }

  /** Loads the current slide's large image first, then its neighbours'. */
  async function loadAround(session: Session): Promise<void> {
    const [prev, now, next] = session.slots;
    await load(session, now);
    await Promise.all([load(session, prev), load(session, next)]);
  }

  async function load(session: Session, slide: SlideEl | null): Promise<void> {
    if (!slide) return;
    await loadLarge(slide, (fitOf(session, slide)?.width ?? session.size.width) * slide.base);
    if (s !== session) return;
    place(session);
    sync();
  }

  function open(index: number): void {
    if (s) return;
    const slides = readSlides(gallery, galleryId);
    if (!slides[index]) return;
    dialog.showModal();
    viewport.focus({ preventScroll: true });
    const session = createSession(slides, index, loop, viewport);
    s = session;
    bind(session);
    const slide = current(session);
    emit("open", slide.data);
    emit("change", slide.data);
    place(session);
    dialog.style.setProperty("--dlb-opacity", "1");
    sync();
    void loadAround(session);
  }

  /** The session's listeners, all removed by session.abort.abort(). */
  function bind(session: Session): void {
    const { signal } = session.abort;
    const click = (elements: HTMLElement[], action: () => void): void => {
      for (const element of elements) element.addEventListener("click", action, { signal });
    };
    click(controls.close, () => close());
    dialog.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        close();
      },
      { signal },
    );
    // The browser closed the dialog itself, after an Escape it didn't let us cancel.
    dialog.addEventListener("close", () => finish(), { signal });
    const resize = new ResizeObserver(() => {
      measure(session, viewport);
      current(session).base = 1;
      session.view = FIT_VIEW;
      place(session);
      sync();
    });
    resize.observe(viewport);
    signal.addEventListener("abort", () => resize.disconnect());
  }

  function close(): void {
    const session = s;
    if (!session || session.closing) return;
    session.closing = true;
    finish();
  }

  /** Ends the session at once. */
  function finish(): void {
    const session = s;
    if (!session) return;
    s = null;
    session.abort.abort();
    session.strip.remove();
    clear(dialog);
    if (dialog.open) dialog.close();
    const slide = current(session);
    slide.data.link.focus({ preventScroll: true });
    emit("close", slide.data);
  }

  gallery.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const index = links().indexOf(link as HTMLAnchorElement);
      if (index < 0) return;
      event.preventDefault();
      open(index);
    },
    { signal: life.signal },
  );

  return {
    open: (index = 0) => open(index),
    close: () => close(),
    get current() {
      return s ? toSlide(current(s).data) : null;
    },
    get count() {
      return s ? s.slides.length : links().length;
    },
    on(type, handler) {
      handlers[type].add(handler);
      return () => {
        handlers[type].delete(handler);
      };
    },
    destroy() {
      finish();
      life.abort();
    },
  };
}
```

`src/index.ts`:

```ts
export { type Lightbox, type LightboxEvent, type LightboxOptions, lightbox, type Slide } from "./dom/lightbox";
```

- [ ] **Step 15: Run every test**

Run: `bun run test:browser`
Expected: PASS, 11 tests in each of Chromium and WebKit.

Run: `bun run test && bunx biome check --write . && bun run check`
Expected: all unit tests pass, no lint or type errors.

- [ ] **Step 16: Commit**

```bash
git add package.json playwright.config.ts scripts/serve.ts src test/browser
git commit -m "Open and close the box, fit photos and load them" -m "lightbox() reads the gallery's links on every open, shows the thumbnail as a placeholder, fits the photo into the viewport's padded box and lays the decoded large image over it. Closing removes every listener of the session at once and puts focus back on the link." -m "The browser tests run in Chromium and WebKit against a fixture page served by Bun."
```

---

### Task 8: Navigation between slides

**Files:**
- Create: `src/dom/navigate.ts`, `test/browser/navigation.spec.ts`
- Modify: `src/dom/lightbox.ts`

**Interfaces:**
- Consumes: `spring` (motion), `step` (navigation), `play` (animate), `current`, `GAP`, `place`, `Session`, `setSlots` (session).
- Produces:
  - `src/dom/navigate.ts`: `springStrip(s: Session, to: number, velocity: number): Promise<void>` and `change(s: Session, direction: -1 | 1, velocity: number, changed: () => void): void`
  - `Lightbox` gains `goTo(index: number): void`, `next(): void`, `prev(): void`
  - inside `lightbox()`: `changed()`, `go(direction)`, `onKey(event)` (later tasks extend `changed` and `onKey`)

- [ ] **Step 1: Write the failing tests**

`test/browser/navigation.spec.ts`:

```ts
import { expect, openAt, test } from "./helpers";

test("next and previous move one slide and are disabled at the ends", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  const counter = page.locator("[data-dlb-counter]");
  await expect(page.locator("[data-dlb-prev]")).toBeDisabled();
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-first", "");
  await page.locator("[data-dlb-next]").click();
  await expect(counter).toHaveText("2 / 7");
  await expect(page.locator("[data-dlb-prev]")).toBeEnabled();
  await page.locator("[data-dlb-prev]").click();
  await expect(counter).toHaveText("1 / 7");
  expect(await page.evaluate(() => window.log)).toEqual(["open:wide", "change:wide", "change:one-2", "change:wide"]);
});

test("arrow keys move between slides", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("2 / 7");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 7");
});

test("the last slide stops there", async ({ fixture: page }) => {
  await openAt(page, "one", 6);
  await expect(page.locator("[data-dlb-next]")).toBeDisabled();
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-last", "");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("7 / 7");
});

test("a looping gallery wraps around", async ({ fixture: page }) => {
  await openAt(page, "two", 0);
  await expect(page.locator("[data-dlb-prev]")).toBeEnabled();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("3 / 3");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 3");
});

test("only the current slide is exposed to screen readers", async ({ fixture: page }) => {
  await openAt(page, "one", 1);
  await expect(page.locator("[data-dlb-slide]")).toHaveCount(3);
  await expect(page.locator("[data-dlb-slide][aria-hidden='false']")).toHaveCount(1);
  await expect(page.locator("[data-dlb-current]")).toHaveAttribute("aria-hidden", "false");
});

test("fast key presses land on the right slide with three slide elements at most", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("4 / 7");
  await expect(page.locator("[data-dlb-slide]")).toHaveCount(3);
});

test("goTo jumps to any slide", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.evaluate(() => window.boxes[0]!.goTo(4));
  await expect(page.locator("[data-dlb-counter]")).toHaveText("5 / 7");
  await expect(page.locator("[data-dlb-slide]")).toHaveCount(3);
});

test("a gallery with one slide can't move", async ({ fixture: page }) => {
  await openAt(page, "three", 0);
  await expect(page.locator("[data-dlb-prev]")).toBeDisabled();
  await expect(page.locator("[data-dlb-next]")).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 1");
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun run test:browser -- navigation`
Expected: FAIL. The counter stays at "1 / 7" and `goTo` is not a function.

- [ ] **Step 3: Write `src/dom/navigate.ts`**

```ts
// Moving between slides: the strip springs to the new slide, or back where there is none.
import { FIT_VIEW } from "../core/geometry";
import { spring } from "../core/motion";
import { step } from "../core/navigation";
import { play } from "./animate";
import { current, GAP, place, type Session, setSlots } from "./session";

/** Springs the strip from where it is to `to`, starting at `velocity` px/ms. */
export async function springStrip(s: Session, to: number, velocity: number): Promise<void> {
  const { frames, duration } = spring([s.stripX], [to], [velocity], 30);
  s.stripX = to;
  place(s);
  await play(s.strip, frames.map(([x = 0]) => ({ transform: `translateX(${x}px)` })), duration);
}

/**
 * Goes one slide back (-1) or forward (1), starting at `velocity`, and calls `changed` once the current
 * slide has changed. Where there is no slide in that direction the strip springs back.
 */
export function change(s: Session, direction: -1 | 1, velocity: number, changed: () => void): void {
  const next = step(s.index, direction, s.slides.length, s.loop);
  if (next !== null) {
    current(s).base = 1;
    s.view = FIT_VIEW;
    // The new current slide keeps its place on screen; the strip then springs it to the middle.
    s.stripX += direction * s.size.width * (1 + GAP);
    setSlots(s, next);
    changed();
  }
  void springStrip(s, 0, velocity);
}
```

- [ ] **Step 4: Wire navigation into `src/dom/lightbox.ts`**

Add the imports:

```ts
import { change } from "./navigate";
import { createSession, current, fitOf, measure, place, type Session, setSlots } from "./session";
```

(The second line replaces the existing import from `./session`.)

Add to the `Lightbox` interface, after `close(): void;`:

```ts
  goTo(index: number): void;
  next(): void;
  prev(): void;
```

Add these functions after `load()`:

```ts
  /** After the current slide changed: events, state, loading. */
  function changed(): void {
    if (!s) return;
    emit("change", current(s).data);
    sync();
    void loadAround(s);
  }

  function go(direction: -1 | 1): void {
    if (s && !s.busy && !s.closing) change(s, direction, 0, changed);
  }

  function onKey(event: KeyboardEvent): void {
    if (!s || s.closing) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, select, textarea")) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      go(event.key === "ArrowLeft" ? -1 : 1);
    }
  }
```

In `bind()`, after `click(controls.close, () => close());`, add:

```ts
    click(controls.prev, () => go(-1));
    click(controls.next, () => go(1));
    dialog.addEventListener("keydown", onKey, { signal });
```

In the returned object, after `close: () => close(),`, add:

```ts
    goTo(index) {
      if (!s || s.busy || s.closing || index === s.index || !s.slides[index]) return;
      // A neighbour gets the slide animation; any other slide is a jump.
      const forward = index === step(s.index, 1, s.slides.length, loop);
      if (forward || index === step(s.index, -1, s.slides.length, loop)) {
        change(s, forward ? 1 : -1, 0, changed);
        return;
      }
      current(s).base = 1;
      s.view = FIT_VIEW;
      s.stripX = 0;
      setSlots(s, index);
      place(s);
      changed();
    },
    next: () => go(1),
    prev: () => go(-1),
```

- [ ] **Step 5: Run the tests**

Run: `bun run test:browser`
Expected: PASS, the navigation tests and every earlier test.

Run: `bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/dom/navigate.ts src/dom/lightbox.ts test/browser/navigation.spec.ts
git commit -m "Move between slides with buttons, arrow keys and goTo()" -m "The strip springs to the new slide. Without loop the buttons are disabled at the ends and keys do nothing there; with loop the last slide is followed by the first."
```

---

### Task 9: Opening and closing animations

**Files:**
- Create: `src/dom/transitions.ts`, `test/browser/animation.spec.ts`
- Modify: `src/dom/lightbox.ts`

**Interfaces:**
- Consumes: `thumbStart`, `viewRect`, `NO_INSETS`, `Rect`, `Insets` (geometry); `play`, `placeAt`, `clipAt`, `DURATION`, `EASE` (animate); `current`, `fitOf`, `place`, `wrapperSize`, `Session` (session).
- Produces, from `src/dom/transitions.ts`:
  - `openAnimation(s: Session, dialog: HTMLElement): Promise<void>`
  - `closeAnimation(s: Session, dialog: HTMLElement): Promise<void>`
  - `backdrop(dialog: HTMLElement, to: number, from?: number): Promise<void>` (animates `--dlb-opacity`; Task 12 uses it)
- `close()` inside `lightbox()` becomes `async close(): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`test/browser/animation.spec.ts`:

```ts
import type { Page } from "@playwright/test";
import { expect, openAt, test } from "./helpers";

test.use({ reducedMotion: "no-preference" });

/** Waits until the current slide's media have no running animation. */
const settled = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => {
    const media = document.querySelector("[data-dlb-current] > div");
    return media !== null && media.getAnimations().length === 0;
  });

test("opening zooms out of the thumbnail, which hides meanwhile", async ({ fixture: page }) => {
  const state = await page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>("#one a")!;
    link.click();
    const media = document.querySelector("[data-dlb-current] > div")!;
    const effect = media.getAnimations()[0]?.effect;
    const keyframes = effect instanceof KeyframeEffect ? effect.getKeyframes() : [];
    return {
      animations: media.getAnimations().length,
      clipStart: String(keyframes[0]?.clipPath ?? ""),
      thumb: getComputedStyle(link.querySelector("img")!).visibility,
    };
  });
  expect(state.animations).toBe(1);
  // wide-thumb.svg is 4:1 in a 3:2 box with object-fit: cover, so the zoom starts clipped at the sides.
  expect(state.clipStart).toMatch(/^inset\(0px [1-9]/);
  expect(state.thumb).toBe("hidden");
  await settled(page);
  await expect(page.locator("#one a img").first()).toHaveCSS("visibility", "visible");
});

test("after opening the backdrop is fully opaque", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await settled(page);
  const opacity = await page.evaluate(() =>
    getComputedStyle(document.querySelector("dialog")!).getPropertyValue("--dlb-opacity").trim(),
  );
  expect(opacity).toBe("1");
});

test("with reduced motion nothing animates", async ({ fixture: page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const animations = await page.evaluate(() => {
    document.querySelector<HTMLAnchorElement>("#one a")!.click();
    return document.querySelector("[data-dlb-current] > div")!.getAnimations().length;
  });
  expect(animations).toBe(0);
});

test("closing scrolls the current thumbnail into view first", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await settled(page);
  await page.evaluate(() => window.boxes[0]!.goTo(6));
  await expect(page.locator("[data-dlb-counter]")).toHaveText("7 / 7");
  const link = page.locator("#one a").nth(6);
  expect((await link.boundingBox())!.x).toBeGreaterThan(390);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  const box = (await link.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(link.locator("img")).toHaveCSS("visibility", "visible");
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun run test:browser -- animation`
Expected: FAIL: no animation runs on open, and the last thumbnail is still off screen after closing.

- [ ] **Step 3: Write `src/dom/transitions.ts`**

```ts
// The opening and closing zoom between a thumbnail and the box, or a fade when no thumbnail is on screen.
import { type Insets, NO_INSETS, type Rect, thumbStart, viewRect } from "../core/geometry";
import { clipAt, DURATION, EASE, placeAt, play } from "./animate";
import { current, fitOf, place, type Session, wrapperSize } from "./session";
import type { SlideEl } from "./slides";

export async function openAnimation(s: Session, dialog: HTMLElement): Promise<void> {
  const slide = current(s);
  const f = fitOf(s, slide);
  const thumb = onScreen(slide);
  place(s);
  if (!f || !thumb) {
    await Promise.all([play(slide.media, [{ opacity: 0 }, { opacity: 1 }], DURATION, EASE), backdrop(dialog, 1, 0)]);
    return;
  }
  const size = wrapperSize(slide, f);
  const start = frameOf(s, slide, thumb);
  thumb.style.visibility = "hidden";
  await Promise.all([
    play(
      slide.media,
      [
        { transform: placeAt(start.rect, size), clipPath: clipAt(start.clip, start.rect, size) },
        { transform: placeAt(f, size), clipPath: clipAt(NO_INSETS, f, size) },
      ],
      DURATION,
      EASE,
    ),
    backdrop(dialog, 1, 0),
  ]);
  thumb.style.visibility = "";
}

/** Scrolls the current slide's thumbnail into view, then zooms back onto it from wherever the media are. */
export async function closeAnimation(s: Session, dialog: HTMLElement): Promise<void> {
  const slide = current(s);
  slide.data.link.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  const f = fitOf(s, slide);
  const thumb = onScreen(slide);
  if (!f || !thumb) {
    slide.media.style.opacity = "0";
    await Promise.all([play(slide.media, [{ opacity: 1 }, { opacity: 0 }], DURATION, EASE), backdrop(dialog, 0)]);
    return;
  }
  const size = wrapperSize(slide, f);
  const now = viewRect(f, s.view);
  const end = frameOf(s, slide, thumb);
  slide.media.style.transform = placeAt(end.rect, size);
  slide.media.style.clipPath = clipAt(end.clip, end.rect, size);
  thumb.style.visibility = "hidden";
  await Promise.all([
    play(
      slide.media,
      [
        { transform: placeAt(now, size), clipPath: clipAt(NO_INSETS, now, size) },
        { transform: placeAt(end.rect, size), clipPath: clipAt(end.clip, end.rect, size) },
      ],
      DURATION,
      EASE,
    ),
    backdrop(dialog, 0),
  ]);
  thumb.style.visibility = "";
}

/** Animates --dlb-opacity on the dialog to `to`, from `from` or from its current value. */
export function backdrop(dialog: HTMLElement, to: number, from?: number): Promise<void> {
  const start = from ?? (Number.parseFloat(getComputedStyle(dialog).getPropertyValue("--dlb-opacity")) || 0);
  dialog.style.setProperty("--dlb-opacity", String(to));
  return play(dialog, [{ "--dlb-opacity": String(start) }, { "--dlb-opacity": String(to) }], DURATION, EASE);
}

/** The slide's thumbnail if it has a size and lies inside the window, else null. */
function onScreen(slide: SlideEl): HTMLImageElement | null {
  const thumb = slide.data.thumb;
  if (!thumb) return null;
  const r = thumb.getBoundingClientRect();
  const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  return visible ? thumb : null;
}

/** The thumbnail's frame in viewport coordinates, with the crop of object-fit: cover. */
function frameOf(s: Session, slide: SlideEl, thumb: HTMLImageElement): { rect: Rect; clip: Insets } {
  const r = thumb.getBoundingClientRect();
  const box = { x: r.left - s.origin.x, y: r.top - s.origin.y, width: r.width, height: r.height };
  return thumbStart(box, slide.data.aspect!, getComputedStyle(thumb).objectFit === "cover");
}
```

- [ ] **Step 4: Use the animations in `src/dom/lightbox.ts`**

Add the import:

```ts
import { closeAnimation, openAnimation } from "./transitions";
```

Replace `open()` with:

```ts
  function open(index: number): void {
    if (s) return;
    const slides = readSlides(gallery, galleryId);
    if (!slides[index]) return;
    dialog.showModal();
    viewport.focus({ preventScroll: true });
    const session = createSession(slides, index, loop, viewport);
    s = session;
    session.busy = true;
    bind(session);
    const slide = current(session);
    emit("open", slide.data);
    emit("change", slide.data);
    sync();
    void loadAround(session);
    void openAnimation(session, dialog).then(() => {
      session.busy = false;
    });
  }
```

Replace `close()` with:

```ts
  /** Closes with the zoom back to the thumbnail. */
  async function close(): Promise<void> {
    const session = s;
    if (!session || session.closing) return;
    session.closing = true;
    await closeAnimation(session, dialog);
    finish();
  }
```

`close()` now returns a promise, so its three callers discard it explicitly:
- in `bind()`: `click(controls.close, () => void close());`
- in the `cancel` listener: `void close();` instead of `close();`
- in the returned object: `close: () => void close(),`

- [ ] **Step 5: Run the tests**

Run: `bun run test:browser`
Expected: PASS, the animation tests and every earlier test.

Run: `bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/dom/transitions.ts src/dom/lightbox.ts test/browser/animation.spec.ts
git commit -m "Zoom between the thumbnail and the box when opening and closing" -m "A thumbnail cropped with object-fit: cover opens with the photo clipped to the frame, and the clip opens while it grows. Before closing, the current slide's thumbnail is scrolled into view so the zoom always lands on it. Without a visible thumbnail the box fades, and with reduced motion nothing animates."
```

---

### Task 10: Zoom

**Files:**
- Create: `src/dom/zoom.ts`, `test/browser/zoom.spec.ts`
- Modify: `src/dom/lightbox.ts`

**Interfaces:**
- Consumes: `clampView`, `FIT_VIEW`, `panBounds`, `viewRect`, `zoomAt`, `zoomTarget`, `Point`, `View` (geometry); `play`, `placeAt`, `DURATION`, `EASE` (animate); `current`, `fitOf`, `place`, `wrapperSize`, `Session` (session).
- Produces, from `src/dom/zoom.ts`:
  - `zoomOf(s: Session, slide: SlideEl): number | null`
  - `toggleZoom(s: Session, sync: () => void, point?: Point): Promise<void>` (Task 12 calls it for clicks and double taps)

- [ ] **Step 1: Write the failing tests**

`test/browser/zoom.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun run test:browser -- zoom`
Expected: FAIL: `data-dlb-zoomable` is never set and the zoom button does nothing.

- [ ] **Step 3: Write `src/dom/zoom.ts`**

```ts
// Zooming a photo in and out: by click, double tap or the zoom button.
import { clampView, FIT_VIEW, panBounds, type Point, type View, viewRect, zoomAt, zoomTarget } from "../core/geometry";
import { DURATION, EASE, placeAt, play } from "./animate";
import { current, fitOf, place, type Session, wrapperSize } from "./session";
import type { SlideEl } from "./slides";

/** How far a slide zooms, or null when it can't: videos, small photos, unknown sizes, errors. */
export function zoomOf(s: Session, slide: SlideEl): number | null {
  const f = fitOf(s, slide);
  if (!f || slide.data.type !== "image" || slide.status === "error") return null;
  return zoomTarget(slide.data.native, f.width);
}

/** Zooms in around `point` (the photo's center without one), or back out to fit when zoomed. */
export async function toggleZoom(s: Session, sync: () => void, point?: Point): Promise<void> {
  const slide = current(s);
  const f = fitOf(s, slide);
  const zoom = zoomOf(s, slide);
  if (!f || zoom === null) return;
  const from = s.view;
  const center = point ?? { x: f.x + f.width / 2, y: f.y + f.height / 2 };
  const target: View =
    from.scale > 1.01 ? FIT_VIEW : clampView(zoomAt(from, f, center, zoom), panBounds(f, zoom, s.size));
  s.view = target;
  place(s);
  sync();
  const size = wrapperSize(slide, f);
  await play(
    slide.media,
    [{ transform: placeAt(viewRect(f, from), size) }, { transform: placeAt(viewRect(f, target), size) }],
    DURATION,
    EASE,
  );
  if (current(s) !== slide || s.view !== target) return;
  // Re-render at the new size: the browser draws sharp pixels, and srcset can pick a larger file.
  slide.base = target.scale;
  if (slide.large?.srcset) slide.large.sizes = `${Math.round(f.width * target.scale)}px`;
  place(s);
}
```

- [ ] **Step 4: Wire zoom into `src/dom/lightbox.ts`**

Add the import:

```ts
import { toggleZoom, zoomOf } from "./zoom";
```

In `sync()`, replace the two zoom lines with:

```ts
      zoomable: zoomOf(s, slide) !== null,
      zoomed: s.view.scale > 1.01,
```

In `bind()`, after the prev and next clicks, add:

```ts
    click(controls.zoom, () => void toggleZoom(session, sync));
```

- [ ] **Step 5: Run the tests**

Run: `bun run test:browser`
Expected: PASS, the zoom tests and every earlier test.

Run: `bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/dom/zoom.ts src/dom/lightbox.ts test/browser/zoom.spec.ts
git commit -m "Zoom photos with the zoom button" -m "A photo zooms to three times its fit size, never past its native width, and only when that is at least 1.2 times. After the animation the media are re-rendered at the zoomed size, so the browser draws sharp pixels and srcset can load a larger file. Resizing resets the zoom."
```

---

### Task 11: Video

**Files:**
- Create: `src/dom/video.ts`, `test/browser/video.spec.ts`
- Modify: `src/dom/lightbox.ts`

**Interfaces:**
- Consumes: `initialVideo`, `video`, `VideoEffect`, `VideoEvent`, `VideoState` (core video); `FILL` (slides).
- Produces, from `src/dom/video.ts`:
  - `interface VideoController { readonly element: HTMLVideoElement; readonly state: VideoState; activate(container: HTMLElement, src: string, progress: HTMLElement[]): void; deactivate(): void; pause(): void; send(event: VideoEvent): void }`
  - `createVideo(onChange: () => void, signal: AbortSignal): VideoController`
- `Lightbox` gains `readonly video: HTMLVideoElement`. Task 12 passes `video.send({ type: "toggle" })` to the pointer code.

- [ ] **Step 1: Write the failing tests**

`test/browser/video.spec.ts`:

```ts
import { expect, openAt, test } from "./helpers";

test("a video slide plays muted, looped and without native controls", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  const dialog = page.locator("dialog");
  const video = page.locator("[data-dlb-current] video");
  await expect(video).toHaveCount(1);
  await expect(dialog).toHaveAttribute("data-dlb-type", "video");
  await expect(dialog).not.toHaveAttribute("data-dlb-paused");
  await expect(dialog).toHaveAttribute("data-dlb-muted", "");
  await expect(page.locator("[data-dlb-play]")).toHaveAttribute("aria-pressed", "true");
  const element = await video.evaluate((v: HTMLVideoElement) => ({
    muted: v.muted,
    controls: v.controls,
    loop: v.loop,
    inline: v.playsInline,
  }));
  expect(element).toEqual({ muted: true, controls: false, loop: true, inline: true });
  // Revealed over the poster once a frame is painted.
  await expect(video).toHaveCSS("opacity", "1");
});

test("the play button and Space pause and resume", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  const dialog = page.locator("dialog");
  await expect(dialog).not.toHaveAttribute("data-dlb-paused");
  await page.locator("[data-dlb-play]").click();
  await expect(dialog).toHaveAttribute("data-dlb-paused", "");
  await page.locator("[data-dlb-viewport]").focus();
  await page.keyboard.press(" ");
  await expect(dialog).not.toHaveAttribute("data-dlb-paused");
});

test("the mute button and M turn the sound on and off", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  const mute = page.locator("[data-dlb-mute]");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  expect(await page.locator("[data-dlb-current] video").evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
  await page.locator("[data-dlb-viewport]").focus();
  await page.keyboard.press("m");
  await expect(mute).toHaveAttribute("aria-pressed", "true");
});

test("sound stays on for the next video", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  await page.locator("[data-dlb-mute]").click();
  await page.locator("[data-dlb-next]").click();
  await expect(page.locator("[data-dlb-counter]")).toHaveText("5 / 7");
  expect(await page.locator("[data-dlb-current] video").evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
});

test("a clip without audio disables the mute button", async ({ fixture: page }) => {
  await openAt(page, "one", 5);
  await expect(page.locator("dialog")).toHaveAttribute("data-dlb-noaudio", "");
  await expect(page.locator("[data-dlb-mute]")).toBeDisabled();
});

test("leaving the video releases it", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  await expect(page.locator("[data-dlb-current] video")).toHaveCount(1);
  await page.locator("[data-dlb-prev]").click();
  await expect(page.locator("[data-dlb-counter]")).toHaveText("3 / 7");
  await expect(page.locator("video")).toHaveCount(0);
  expect(await page.evaluate(() => window.boxes[0]!.video.hasAttribute("src"))).toBe(false);
});

test("the progress element follows the playback", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  const progress = page.locator("[data-dlb-progress]");
  await expect
    .poll(() => progress.evaluate((el) => Number.parseFloat(getComputedStyle(el).getPropertyValue("--dlb-progress")) || 0))
    .toBeGreaterThan(0);
});

test("closing releases the video", async ({ fixture: page }) => {
  await openAt(page, "one", 3);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page.locator("video")).toHaveCount(0);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun run test:browser -- video`
Expected: FAIL: the current slide has no `<video>`, only its poster.

- [ ] **Step 3: Write `src/dom/video.ts`**

```ts
// The one <video> element of a lightbox. It moves into the current video slide, plays without native controls,
// and reports through the core state machine; the element's own events are the source of truth.
import { initialVideo, type VideoEffect, type VideoEvent, type VideoState, video as next } from "../core/video";
import { FILL } from "./slides";

export interface VideoController {
  readonly element: HTMLVideoElement;
  readonly state: VideoState;
  /** Moves the element into `container`, loads `src` and starts it. Call it inside the user's event. */
  activate(container: HTMLElement, src: string, progress: HTMLElement[]): void;
  /** Stops and releases the video; does nothing when idle. */
  deactivate(): void;
  /** Pauses without releasing, for the closing animation. */
  pause(): void;
  send(event: VideoEvent): void;
}

type SaveData = { connection?: { saveData?: boolean } };

export function createVideo(onChange: () => void, signal: AbortSignal): VideoController {
  const element = document.createElement("video");
  // The muted property, not the attribute: an attribute added by a script doesn't mute.
  element.muted = true;
  element.loop = true;
  element.playsInline = true;
  element.preload = "metadata";
  for (const name of ["playsinline", "disablepictureinpicture", "disableremoteplayback"]) element.setAttribute(name, "");
  element.style.cssText = `${FILL};opacity:0`;
  let state = initialVideo;
  let src = "";
  let progress: HTMLElement[] = [];
  let ticking = false;

  const send = (event: VideoEvent): void => {
    const result = next(state, event);
    state = result.state;
    for (const effect of result.effects) run(effect);
    onChange();
  };

  const run = (effect: VideoEffect): void => {
    if (effect.type === "load") {
      element.style.opacity = "0";
      element.src = src;
      // Invisible over the poster until a frame is painted, so there is no black flash.
      element.requestVideoFrameCallback(() => {
        element.style.opacity = "1";
      });
    } else if (effect.type === "play") {
      element.play().catch((error: unknown) => {
        send({ type: "rejected", error: error instanceof DOMException ? error.name : "Error" });
      });
    } else if (effect.type === "pause") {
      element.pause();
    } else if (effect.type === "release") {
      element.pause();
      element.removeAttribute("src");
      element.load();
      element.remove();
    } else {
      element.muted = effect.muted;
    }
  };

  /** Writes --dlb-progress on every painted frame while playing. */
  const tick = (): void => {
    const value = element.duration ? element.currentTime / element.duration : 0;
    for (const bar of progress) bar.style.setProperty("--dlb-progress", String(value));
    ticking = !element.paused && element.isConnected;
    if (ticking) element.requestVideoFrameCallback(tick);
  };

  const listen = (type: string, handler: () => void): void => element.addEventListener(type, handler, { signal });
  listen("playing", () => {
    send({ type: "playing" });
    if (!ticking) tick();
  });
  listen("pause", () => send({ type: "pause" }));
  listen("waiting", () => send({ type: "waiting" }));
  listen("error", () => send({ type: "error" }));
  listen("volumechange", () => {
    if (element.muted !== state.muted) send({ type: "volume", muted: element.muted });
  });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (state.phase !== "idle") send({ type: document.hidden ? "hidden" : "visible" });
    },
    { signal },
  );

  return {
    element,
    get state() {
      return state;
    },
    activate(container, url, bars) {
      src = url;
      progress = bars;
      container.append(element);
      send({ type: "activate", saveData: Boolean((navigator as Navigator & SaveData).connection?.saveData) });
    },
    deactivate() {
      if (state.phase !== "idle") send({ type: "deactivate" });
    },
    pause() {
      element.pause();
    },
    send,
  };
}
```

- [ ] **Step 4: Wire the video into `src/dom/lightbox.ts`**

Add the import:

```ts
import { createVideo } from "./video";
```

Add to the `Lightbox` interface, after `readonly count: number;`:

```ts
  readonly video: HTMLVideoElement;
```

After the `handlers` declaration, add:

```ts
  const video = createVideo(() => sync(), life.signal);
```

Replace `sync()` with:

```ts
  /** Writes the state attributes and the buttons' state for the current slide. */
  function sync(): void {
    if (!s) return;
    const slide = current(s);
    const isVideo = slide.data.type === "video";
    const v = video.state;
    render(dialog, controls, {
      type: slide.data.type,
      index: s.index,
      count: s.slides.length,
      first: step(s.index, -1, s.slides.length, loop) === null,
      last: step(s.index, 1, s.slides.length, loop) === null,
      loading: isVideo ? v.loading : slide.status === "loading",
      error: isVideo ? v.phase === "error" : slide.status === "error",
      zoomable: zoomOf(s, slide) !== null,
      zoomed: s.view.scale > 1.01,
      uiHidden: s.uiHidden,
      paused: isVideo && v.phase !== "playing" && v.phase !== "starting",
      muted: v.muted,
      noaudio: isVideo && !slide.data.audio,
    });
  }
```

Replace `changed()` with:

```ts
  /** After the current slide changed: video, events, state, loading. */
  function changed(): void {
    if (!s) return;
    const slide = current(s);
    video.deactivate();
    if (slide.data.type === "video") video.activate(slide.media, slide.data.src, controls.progress);
    emit("change", slide.data);
    sync();
    void loadAround(s);
  }
```

In `open()`, right after `const slide = current(session);`, add (still inside the click, so it counts as a user gesture):

```ts
    if (slide.data.type === "video") video.activate(slide.media, slide.data.src, controls.progress);
```

In `bind()`, after the zoom click, add:

```ts
    click(controls.play, () => video.send({ type: "toggle" }));
    click(controls.mute, () => video.send({ type: "toggle-mute" }));
```

Replace `onKey()` with:

```ts
  function onKey(event: KeyboardEvent): void {
    if (!s || s.closing) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, select, textarea")) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      go(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    // Space and M on a video, unless a button has focus: Space would press it as well and toggle twice.
    const action = event.key === " " ? "toggle" : event.key.toLowerCase() === "m" ? "toggle-mute" : null;
    if (action && current(s).data.type === "video" && !target?.closest("button")) {
      event.preventDefault();
      video.send({ type: action });
    }
  }
```

In `close()`, before `await closeAnimation(session, dialog);`, add:

```ts
    video.pause();
```

In `finish()`, right after `s = null;`, add:

```ts
    video.deactivate();
```

In the returned object, after the `count` getter, add:

```ts
    video: video.element,
```

- [ ] **Step 5: Run the tests**

Run: `bun run test:browser`
Expected: PASS, the video tests and every earlier test. If a video test fails in WebKit only because headless playback never starts (the dialog keeps `data-dlb-paused` and the console shows no error from the library), stop and report it with the output instead of changing the library.

Run: `bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/dom/video.ts src/dom/lightbox.ts test/browser/video.spec.ts
git commit -m "Play videos inline without native controls" -m "One video element per lightbox moves into the current slide and starts muted inside the user's click, so iOS lets it play. The page's play, mute and progress elements are wired up, Space and M work on video slides, and the sound setting carries over to the next video. Leaving a video releases it."
```

---

### Task 12: Gestures

**Files:**
- Create: `src/dom/pointer.ts`, `test/browser/gestures.spec.ts`
- Modify: `src/dom/lightbox.ts`

**Interfaces:**
- Consumes: `gesture`, `GestureInput`, `Intent`, `Mode`, `PointerKind`, `Target` (core gesture); `dismissProgress`, `dismissView`, `project`, `resist`, `rubber`, `shouldDismiss`, `spring`, `swipeDirection` (motion); `clampView`, `FIT_VIEW`, `panBounds`, `viewRect`, `Rect`, `View` (geometry); `step` (navigation); `placeAt`, `play`, `stop` (animate); `change`, `springStrip` (navigate); `current`, `fitOf`, `place`, `wrapperSize`, `Session` (session); `backdrop` (transitions); `toggleZoom`, `zoomOf` (zoom).
- Produces, from `src/dom/pointer.ts`:
  - `interface PointerHooks { changed(): void; close(): void; sync(): void; toggleVideo(): void }`
  - `bindPointer(s: Session, viewport: HTMLElement, dialog: HTMLElement, hooks: PointerHooks): void` (listeners end with `s.abort`)

- [ ] **Step 1: Write the failing tests**

`test/browser/gestures.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run them and see them fail**

Run: `bun run test:browser -- gestures`
Expected: FAIL: pointer events on the viewport do nothing yet.

- [ ] **Step 3: Write `src/dom/pointer.ts`**

```ts
// Pointer events on the viewport go through the gesture state machine; its intents become swipes, pans,
// drags down to close, taps and double taps.
import { clampView, FIT_VIEW, panBounds, type Rect, type View, viewRect } from "../core/geometry";
import { type GestureInput, gesture, type Intent, type Mode, type PointerKind, type Target } from "../core/gesture";
import {
  dismissProgress,
  dismissView,
  project,
  resist,
  rubber,
  shouldDismiss,
  spring,
  swipeDirection,
} from "../core/motion";
import { step } from "../core/navigation";
import { placeAt, play, stop } from "./animate";
import { change, springStrip } from "./navigate";
import { current, fitOf, place, type Session, wrapperSize } from "./session";
import type { SlideEl } from "./slides";
import { backdrop } from "./transitions";
import { toggleZoom, zoomOf } from "./zoom";

export interface PointerHooks {
  /** The current slide changed after a swipe. */
  changed(): void;
  close(): void;
  sync(): void;
  toggleVideo(): void;
}

type Tap = Extract<Intent, { type: "tap" }>;

const MOVES = { pointermove: "move", pointerup: "up", pointercancel: "cancel" } as const;

export function bindPointer(s: Session, viewport: HTMLElement, dialog: HTMLElement, hooks: PointerHooks): void {
  /** place() on the next animation frame, at most once per frame. */
  const schedule = (): void => {
    s.frame ||= requestAnimationFrame(() => {
      s.frame = 0;
      place(s);
    });
  };

  /** Stops running animations and takes the state from the screen, so a new drag starts from there. */
  const interrupt = (): void => {
    s.stripX = stop(s.strip).e;
    const slide = current(s);
    const f = fitOf(s, slide);
    if (!f) return;
    // The media's transform is translate(fit + view) scale(view.scale / base).
    const m = stop(slide.media);
    s.view = { scale: m.a * slide.base, x: m.e - f.x, y: m.f - f.y };
    place(s);
  };

  const targetAt = (x: number, y: number): Target => {
    const slide = current(s);
    const f = fitOf(s, slide);
    const r = f ? viewRect(f, s.view) : null;
    const bounds = f ? panBounds(f, s.view.scale, s.size) : null;
    return {
      area: r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height ? "media" : "outside",
      type: slide.data.type,
      zoomable: zoomOf(s, slide) !== null,
      zoomed: s.view.scale > 1.01,
      atLeft: !bounds || s.view.x >= bounds.maxX - 1,
      atRight: !bounds || s.view.x <= bounds.minX + 1,
    };
  };

  const springView = (slide: SlideEl, f: Rect, target: View, vx: number, vy: number): void => {
    const { frames, duration } = spring([s.view.scale, s.view.x, s.view.y], [target.scale, target.x, target.y], [0, vx, vy], 12);
    const size = wrapperSize(slide, f);
    s.view = target;
    place(s);
    const keyframes = frames.map(([scale = 1, x = 0, y = 0]) => ({ transform: placeAt(viewRect(f, { scale, x, y }), size) }));
    void play(slide.media, keyframes, duration);
  };

  const drag = (mode: Mode, dx: number, dy: number): void => {
    // A drag begins with dx = dy = 0: remember where everything was.
    if (dx === 0 && dy === 0) s.from = { stripX: s.stripX, view: s.view };
    const { from } = s;
    const f = fitOf(s, current(s));
    if (mode === "swipe") {
      const x = from.stripX + dx;
      const end = step(s.index, x > 0 ? -1 : 1, s.slides.length, s.loop) === null;
      s.stripX = end ? resist(x, s.size.width) : x;
    } else if (f && mode === "pan") {
      const b = panBounds(f, from.view.scale, s.size);
      s.view = {
        scale: from.view.scale,
        x: rubber(from.view.x + dx, b.minX, b.maxX, s.size.width),
        y: rubber(from.view.y + dy, b.minY, b.maxY, s.size.height),
      };
    } else if (f) {
      const progress = dismissProgress(dy, s.size.height);
      s.view = dismissView(f, dx, dy, progress);
      dialog.style.setProperty("--dlb-opacity", String(1 - progress));
    }
    schedule();
  };

  const release = (mode: Mode, dx: number, dy: number, vx: number, vy: number): void => {
    if (mode === "swipe") {
      const direction = swipeDirection(dx, vx, s.size.width);
      if (direction === 0) void springStrip(s, 0, vx);
      else change(s, direction, vx, hooks.changed);
      return;
    }
    const slide = current(s);
    const f = fitOf(s, slide);
    if (!f) return;
    if (mode === "pan") {
      const thrown = { scale: s.view.scale, x: s.view.x + project(vx), y: s.view.y + project(vy) };
      springView(slide, f, clampView(thrown, panBounds(f, s.view.scale, s.size)), vx, vy);
    } else if (shouldDismiss(dy, vy, s.size.height)) {
      hooks.close();
    } else {
      springView(slide, f, FIT_VIEW, vx, vy);
      void backdrop(dialog, 1);
    }
  };

  const tap = ({ x, y, kind, target }: Tap): void => {
    if (target.area === "outside") {
      hooks.close();
    } else if (target.type === "video") {
      hooks.toggleVideo();
    } else if (kind !== "mouse") {
      s.uiHidden = !s.uiHidden;
      hooks.sync();
    } else if (target.zoomable) {
      void toggleZoom(s, hooks.sync, { x, y });
    } else {
      hooks.close();
    }
  };

  const handle = (intent: Intent): void => {
    if (intent.type === "drag") drag(intent.mode, intent.dx, intent.dy);
    else if (intent.type === "release") release(intent.mode, intent.dx, intent.dy, intent.vx, intent.vy);
    else if (intent.type === "abort") release(intent.mode, 0, 0, 0, 0);
    else if (intent.type === "tap") tap(intent);
    else void toggleZoom(s, hooks.sync, intent);
  };

  const feed = (input: GestureInput): void => {
    const result = gesture(s.gesture, input);
    s.gesture = result.state;
    if (result.timer !== undefined) {
      clearTimeout(s.timer);
      if (result.timer !== null) s.timer = setTimeout(() => feed({ type: "timeout", t: performance.now() }), result.timer);
    }
    for (const intent of result.intents) handle(intent);
  };

  const onPointer = (event: PointerEvent): void => {
    if (s.busy || s.closing) return;
    const x = event.clientX - s.origin.x;
    const y = event.clientY - s.origin.y;
    const kind: PointerKind = event.pointerType === "touch" || event.pointerType === "pen" ? event.pointerType : "mouse";
    const pointer = { id: event.pointerId, x, y, t: event.timeStamp, kind };
    if (event.type !== "pointerdown") {
      feed({ ...pointer, type: MOVES[event.type as keyof typeof MOVES] });
      return;
    }
    if (kind === "mouse" && event.button !== 0) return;
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers, as in the tests, can't be captured.
    }
    interrupt();
    feed({ ...pointer, type: "down", target: targetAt(x, y) });
  };

  const options = { signal: s.abort.signal };
  viewport.addEventListener("pointerdown", onPointer, options);
  viewport.addEventListener("pointermove", onPointer, options);
  viewport.addEventListener("pointerup", onPointer, options);
  viewport.addEventListener("pointercancel", onPointer, options);
}
```

- [ ] **Step 4: Bind the pointer in `src/dom/lightbox.ts`**

Add the import:

```ts
import { bindPointer } from "./pointer";
```

At the end of `bind()`, after the `ResizeObserver` lines, add:

```ts
    bindPointer(session, viewport, dialog, {
      changed,
      close: () => void close(),
      sync,
      toggleVideo: () => video.send({ type: "toggle" }),
    });
```

- [ ] **Step 5: Run the tests**

Run: `bun run test:browser`
Expected: PASS, the gesture tests and every earlier test.

Run: `bun run test && bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/dom/pointer.ts src/dom/lightbox.ts test/browser/gestures.spec.ts
git commit -m "Swipe, pan, drag down to close, tap and double tap" -m "Pointer events on the viewport go through the gesture state machine. Swipes and pans keep their momentum and spring back with resistance at the edges; at the edge of a zoomed photo a drag moves on to the next slide. A tap toggles the UI on photos, plays or pauses videos, and closes the box outside the media."
```

- [ ] **Step 7: Early check on a real iPhone (with Max)**

This is the spec's first risk: whether iOS keeps the user gesture for `play()` and for sound after a swipe with one reused video element.

```bash
bun run dev
ipconfig getifaddr en0
```

Ask Max to open `http://<that address>:3000/test/browser/` in Safari on the iPhone, with the iPhone on the same network, and to report:
1. Tap the first clip thumbnail: does the video play muted at once?
2. Tap the sound button, then swipe to the next clip: does it play with sound?
3. Swipe and drag down on the full-screen clip: do both work, and does no Safari control appear?
4. The same with Low Power Mode on: does a tap on the paused video start it?

If 1 to 3 work, go on. If one of them fails, stop and discuss with Max before Task 13; the fallback the spec allows is a fade instead of the zoom when video slides close, nothing else changes without his decision.

---

### Task 13: Back button, deep links and hover preloading

**Files:**
- Create: `src/dom/history.ts`, `test/browser/history.spec.ts`
- Modify: `src/dom/lightbox.ts`, `src/dom/slides.ts`, `test/browser/fixture.ts`

**Interfaces:**
- Produces:
  - `src/dom/history.ts`: `hashId(): string | null`; `interface HistoryLink { open(id: string, deep: boolean): void; change(id: string): void; close(): void }`; `createHistory(onBack: () => void, signal: AbortSignal): HistoryLink`
  - `src/dom/slides.ts`: `preload(data: SlideData, sizes: number): void`
  - `LightboxOptions` gains `history?: boolean` (default true)

- [ ] **Step 1: Pass the option in the fixture**

In `test/browser/fixture.ts`, replace the `lightbox(...)` line with:

```ts
  const box = lightbox({
    gallery,
    dialog,
    loop: gallery.dataset.loop === "true",
    history: gallery.dataset.history !== "false",
  });
```

- [ ] **Step 2: Write the failing tests**

`test/browser/history.spec.ts`:

```ts
import { expect, openAt, test } from "./helpers";

test("opening adds #dlb=<id>, slide changes replace it, and back closes", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await expect(page).toHaveURL(/#dlb=wide$/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#dlb=one-2$/);
  await page.goBack();
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page).not.toHaveURL(/#dlb=/);
});

test("closing with the button removes the hash again", async ({ fixture: page }) => {
  await openAt(page, "one", 0);
  await page.locator("[data-dlb-close]").click();
  await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
  await expect(page).not.toHaveURL(/#dlb=/);
});

test("a URL with #dlb=<id> opens that slide", async ({ page }) => {
  await page.goto("/test/browser/#dlb=one-2");
  await expect(page.locator("dialog")).toHaveAttribute("open", "");
  await expect(page.locator("[data-dlb-counter]")).toHaveText("2 / 7");
  await page.locator("[data-dlb-close]").click();
  await expect(page).toHaveURL(/\/test\/browser\/$/);
});

test("history: false leaves the URL alone", async ({ fixture: page }) => {
  await openAt(page, "three", 0);
  await expect(page.locator("[data-dlb-counter]")).toHaveText("1 / 1");
  await expect(page).not.toHaveURL(/#dlb=/);
});

test("hovering a thumbnail with the mouse starts loading its large image", async ({ fixture: page }) => {
  const request = page.waitForRequest(/media\/tall\.svg$/);
  await page.locator("#one a").nth(1).hover();
  await request;
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `bun run test:browser -- history`
Expected: FAIL: the URL never gets `#dlb=` and hovering loads nothing. `tsc` also complains about the unknown `history` option in `fixture.ts`; that goes away in Step 6.

- [ ] **Step 4: Write `src/dom/history.ts`**

```ts
// The back button and deep links. Opening adds one history entry (#dlb=<id>), slide changes replace it, and
// the back button closes the box instead of leaving the page.
const PREFIX = "#dlb=";

/** The slide id in the URL when the page was opened with #dlb=<id>. */
export function hashId(): string | null {
  return location.hash.startsWith(PREFIX) ? decodeURIComponent(location.hash.slice(PREFIX.length)) : null;
}

export interface HistoryLink {
  /** On open; `deep` when the URL already has the hash, so there is no entry to add. */
  open(id: string, deep: boolean): void;
  change(id: string): void;
  /** When the box closes by any means but the back button: removes the entry, or the hash. */
  close(): void;
}

export function createHistory(onBack: () => void, signal: AbortSignal): HistoryLink {
  let active = false;
  let pushed = false;
  const url = (id: string | null): string =>
    `${location.pathname}${location.search}${id === null ? "" : PREFIX + encodeURIComponent(id)}`;
  addEventListener(
    "popstate",
    () => {
      // After close() went back itself, active is false and this popstate is ignored.
      if (!active) return;
      active = false;
      onBack();
    },
    { signal },
  );
  return {
    open(id, deep) {
      active = true;
      pushed = !deep;
      if (deep) history.replaceState(history.state, "", url(id));
      else history.pushState(history.state, "", url(id));
    },
    change(id) {
      if (active) history.replaceState(history.state, "", url(id));
    },
    close() {
      if (!active) return;
      active = false;
      if (pushed) history.back();
      else history.replaceState(history.state, "", url(null));
    },
  };
}
```

- [ ] **Step 5: Add `preload()` to `src/dom/slides.ts`**

Append:

```ts
const preloaded = new WeakSet<HTMLAnchorElement>();

/** Starts loading a link's large image before it opens (on mouse hover). */
export function preload(data: SlideData, sizes: number): void {
  if (data.type === "video" || preloaded.has(data.link)) return;
  preloaded.add(data.link);
  image(data.src, "", data.srcset, sizes);
}
```

- [ ] **Step 6: Wire history, deep links and preloading into `src/dom/lightbox.ts`**

Change the imports to include the new names (each line replaces the existing import from that module, or is new):

```ts
import { FIT_VIEW, fit } from "../core/geometry";
import { createHistory, hashId } from "./history";
import { readSlide, readSlides, type SlideData } from "./links";
import { areaOf, createSession, current, fitOf, measure, place, type Session, setSlots } from "./session";
import { loadLarge, preload, type SlideEl } from "./slides";
```

Add to `LightboxOptions`:

```ts
  history?: boolean;
```

After `const video = createVideo(...)`, add:

```ts
  const hist = options.history === false ? null : createHistory(() => void close(true), life.signal);
```

Replace `changed()` with:

```ts
  /** After the current slide changed: video, URL, events, state, loading. */
  function changed(): void {
    if (!s) return;
    const slide = current(s);
    video.deactivate();
    if (slide.data.type === "video") video.activate(slide.media, slide.data.src, controls.progress);
    hist?.change(slide.data.id);
    emit("change", slide.data);
    sync();
    void loadAround(s);
  }
```

Replace `open()` with:

```ts
  /** `deep`: opened from a #dlb=<id> URL, so there is no history entry to add. */
  function open(index: number, deep = false): void {
    if (s) return;
    const slides = readSlides(gallery, galleryId);
    if (!slides[index]) return;
    dialog.showModal();
    viewport.focus({ preventScroll: true });
    const session = createSession(slides, index, loop, viewport);
    s = session;
    session.busy = true;
    bind(session);
    const slide = current(session);
    if (slide.data.type === "video") video.activate(slide.media, slide.data.src, controls.progress);
    hist?.open(slide.data.id, deep);
    emit("open", slide.data);
    emit("change", slide.data);
    sync();
    void loadAround(session);
    void openAnimation(session, dialog).then(() => {
      session.busy = false;
    });
  }
```

Replace `close()` with:

```ts
  /** Closes with the zoom back to the thumbnail. `fromBack`: the back button already removed the entry. */
  async function close(fromBack = false): Promise<void> {
    const session = s;
    if (!session || session.closing) return;
    session.closing = true;
    if (!fromBack) hist?.close();
    video.pause();
    await closeAnimation(session, dialog);
    finish();
  }
```

Replace `finish()` with:

```ts
  /** Ends the session at once; also runs when the browser closed the dialog itself. */
  function finish(): void {
    const session = s;
    if (!session) return;
    if (!session.closing) hist?.close();
    s = null;
    video.deactivate();
    session.abort.abort();
    session.strip.remove();
    clear(dialog);
    if (dialog.open) dialog.close();
    const slide = current(session);
    slide.data.link.focus({ preventScroll: true });
    emit("close", slide.data);
  }
```

After the gallery's `click` listener, add:

```ts
  gallery.addEventListener(
    "pointerover",
    (event) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      const index = link ? links().indexOf(link) : -1;
      if (event.pointerType !== "mouse" || !link || index < 0) return;
      const data = readSlide(link, index, galleryId);
      const area = areaOf(viewport, { width: innerWidth, height: innerHeight });
      preload(data, data.aspect ? fit(data.aspect, area).width : area.width);
    },
    { signal: life.signal },
  );

  // A #dlb=<id> URL opens that slide. On the next frame, so the page can register its handlers first.
  const deepId = hist ? hashId() : null;
  if (deepId) {
    requestAnimationFrame(() => {
      const index = readSlides(gallery, galleryId).findIndex((data) => data.id === deepId);
      if (index >= 0) open(index, true);
    });
  }
```

- [ ] **Step 7: Run the tests**

Run: `bun run test:browser`
Expected: PASS, the history tests and every earlier test.

Run: `bun run test && bunx biome check --write . && bun run check`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/dom/history.ts src/dom/slides.ts src/dom/lightbox.ts test/browser/fixture.ts test/browser/history.spec.ts
git commit -m "Close with the back button and open slides from #dlb= links" -m "Opening adds one history entry and slide changes replace it, so the back button closes the box instead of leaving the page. A URL with #dlb=<id> opens that slide. Hovering a thumbnail with the mouse starts loading its large image."
```

---

### Task 14: Build, size budget, README and CI

**Files:**
- Create: `tsconfig.build.json`, `scripts/size.ts`, `README.md`, `LICENSE`, `CHANGELOG.md`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `bun run build` writes `dist/dialog-lightbox.js` (minified ES module), `dist/dialog-lightbox.css` and `dist/types/**/*.d.ts`; `bun run size` fails above the budget. The package exports `.` and `./dialog-lightbox.css` as set in Task 1.

- [ ] **Step 1: Add the build**

`tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "dist/types",
    "rootDir": "src",
    "types": []
  },
  "include": ["src"]
}
```

`scripts/size.ts`:

```ts
// The size budget: the script at most 6 kB minified and gzipped, the CSS at most 1 kB.
const js = await Bun.file("dist/dialog-lightbox.js").bytes();
const css = Bun.file("dist/dialog-lightbox.css").size;
const gzipped = Bun.gzipSync(js).length;

console.log(`dialog-lightbox.js   ${js.length} B minified, ${gzipped} B gzipped (budget 6144)`);
console.log(`dialog-lightbox.css  ${css} B (budget 1024)`);

if (gzipped > 6144 || css > 1024) {
  console.error("Over the size budget.");
  process.exit(1);
}
```

In `package.json`, replace the `scripts` block with:

```json
  "scripts": {
    "build": "rm -rf dist && bun build ./src/index.ts --minify --target=browser --outfile=dist/dialog-lightbox.js && cp src/dialog-lightbox.css dist/ && tsc -p tsconfig.build.json",
    "prepack": "bun run build",
    "check": "biome check . && tsc",
    "test": "bun test ./test/unit",
    "test:browser": "bun --bun playwright test",
    "size": "bun run build && bun scripts/size.ts",
    "dev": "bun scripts/serve.ts"
  },
```

- [ ] **Step 2: Build and check the size**

Run: `bun run size`
Expected: both lines under budget and exit code 0.

If the script is over 6144 bytes gzipped, do not remove features. Run `bun build ./src/index.ts --minify --target=browser --outfile=/dev/null --metafile=meta.json`, list the five largest inputs from `meta.json`, delete `meta.json`, and report the numbers to Max.

- [ ] **Step 3: Check the built package**

```bash
ls dist dist/types
bun -e "const m = await import('./dist/dialog-lightbox.js'); console.log(typeof m.lightbox)"
bun pm pack --dry-run
```

Expected: `dist/dialog-lightbox.js`, `dist/dialog-lightbox.css` and `dist/types/index.d.ts` exist; the import prints `function`; the pack lists only `package.json`, `README.md`, `LICENSE` and files under `dist/`.

- [ ] **Step 4: Write `LICENSE`**

```text
MIT License

Copyright (c) 2026 Maximilian Fettinger

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 5: Write `CHANGELOG.md`**

```markdown
# Changelog

## 0.1.0 (unreleased)

The first version: a lightbox on the native `<dialog>` that opens with a zoom out of the thumbnail, swipes between slides, closes when dragged down, zooms by click or double tap and pans, plays muted inline videos with play, sound and progress, and closes with the back button. `#dlb=<id>` links open a slide.
```

- [ ] **Step 6: Write `README.md`**

````markdown
# dialog-lightbox

A lightweight lightbox on the native `<dialog>`: swipe, zoom, video. It adds behavior; the markup and CSS stay yours.

The script is about 6 kB gzipped and has no dependencies. You write the dialog, its buttons and every style yourself. The library finds the parts by their `data-dlb-*` attributes, adds the behavior, and reports its state as attributes your CSS can use.

What it does:

- opens with a zoom out of the thumbnail, also when the thumbnail is cropped with `object-fit: cover`
- swipe between photos, drag down to close, click or double-tap to zoom, drag to pan
- plays short videos muted and inline, without native controls, so they never get in the way of swiping
- the back button closes the box, and a `#dlb=<id>` link opens a photo directly
- arrow keys and Escape; Space and M on videos

## Install

```sh
npm install dialog-lightbox
```

`bun add` and `pnpm add` work the same way. Without a package manager, copy `dist/dialog-lightbox.js` and `dist/dialog-lightbox.css` from the package into your site.

## Markup

Each thumbnail links to its large file, so the page works without JavaScript too:

```html
<div class="gallery">
  <a href="ferry-1600.webp" data-dlb-srcset="ferry-1080.webp 1080w, ferry-1600.webp 1600w">
    <img src="ferry-480.webp" alt="The ferry at Kiel">
  </a>
  <a href="ride.mp4" data-dlb-type="video">
    <img src="ride-poster.webp" alt="Riding to the ferry">
  </a>
</div>
```

Thumbnails have to show the whole photo. If you want frames, crop them in CSS with `object-fit: cover`; the box then opens by zooming out of the frame.

One dialog serves every gallery on a page:

```html
<dialog aria-label="Photo viewer">
  <div data-dlb-viewport></div>
  <span data-dlb-counter></span>
  <button data-dlb-zoom aria-label="Zoom">…</button>
  <button data-dlb-close aria-label="Close">…</button>
  <button data-dlb-prev aria-label="Previous">…</button>
  <button data-dlb-next aria-label="Next">…</button>
  <div class="video-bar">
    <button data-dlb-play aria-label="Play">…</button>
    <span data-dlb-progress></span>
    <button data-dlb-mute aria-label="Sound">…</button>
  </div>
  <p class="caption"></p>
</dialog>
```

Only the viewport is required. Leave out any button you don't need; gestures and keys still work.

## JavaScript

```js
import { lightbox } from "dialog-lightbox";
import "dialog-lightbox/dialog-lightbox.css";

const dialog = document.querySelector("dialog");
const caption = dialog.querySelector(".caption");

for (const gallery of document.querySelectorAll(".gallery")) {
  const box = lightbox({ gallery, dialog });
  box.on("change", (slide) => {
    caption.textContent = slide.link.querySelector("img")?.alt ?? "";
  });
}
```

| Option | Default | |
|---|---|---|
| `gallery` | | Element whose `<a href>` links are the slides, in order |
| `dialog` | | Your `<dialog>`; several galleries can share one |
| `loop` | `false` | After the last slide comes the first |
| `history` | `true` | The back button closes the box; `#dlb=<id>` opens a slide |

`lightbox()` returns:

| | |
|---|---|
| `open(index = 0)`, `close()` | Open on a slide, or close |
| `next()`, `prev()`, `goTo(index)` | Move while open |
| `current`, `count` | The current slide (`null` while closed) and the number of slides |
| `video` | The one `<video>` element, to configure it or to build your own player on it |
| `on(event, handler)` | `"open"`, `"change"` or `"close"`; returns a function that removes the handler |
| `destroy()` | Closes without animation and removes every listener |

A slide is `{ index, id, type, link }`, where `type` is `"image"` or `"video"` and `link` is the thumbnail's `<a>`. `change` also fires once right after `open`, which makes it the place for captions.

## Attributes

On the links:

| Attribute | |
|---|---|
| `href` | The large image or the video file |
| `data-dlb-type="video"` | A video; the thumbnail is its poster |
| `data-dlb-srcset` | `srcset` for the large image; its largest `w` is taken as the native width |
| `data-dlb-width`, `data-dlb-height` | Native size, if you have it. Without them the thumbnail's aspect ratio is used |
| `data-dlb-id` | A stable id for `#dlb=` links. Without it the id is `<gallery id>-<number>` |
| `data-dlb-audio="false"` | The video has no sound; the mute button is disabled |

Inside the dialog:

| Element | |
|---|---|
| `[data-dlb-viewport]` | Required. The slides go here, gestures start here, and its padding is the room the photo leaves free |
| `[data-dlb-close]`, `[data-dlb-prev]`, `[data-dlb-next]`, `[data-dlb-zoom]` | Buttons; disabled where they can't act |
| `[data-dlb-counter]` | Gets "3 / 16" |
| `[data-dlb-play]`, `[data-dlb-mute]` | Video buttons with `aria-pressed` |
| `[data-dlb-progress]` | Gets `--dlb-progress` from 0 to 1 while a video plays |

State on the dialog, for your CSS: `data-dlb-type` (`image` or `video`), `data-dlb-first`, `data-dlb-last`, `data-dlb-loading`, `data-dlb-error`, `data-dlb-zoomable`, `data-dlb-zoomed`, `data-dlb-ui-hidden` (after a tap on a photo), `data-dlb-paused`, `data-dlb-muted` and `data-dlb-noaudio`. The current slide has `data-dlb-current`. `--dlb-opacity` goes from 0 to 1 while the box opens, and back while it closes or is dragged down.

## CSS

`dialog-lightbox.css` only does layout, in the cascade layer `dialog-lightbox`, so your own styles win without fighting specificity. It also stops the page from scrolling while the box is open. Everything you see comes from your CSS, for example:

```css
dialog[data-dlb] {
  background: transparent;
  color: white;
}

dialog[data-dlb]::backdrop {
  background: rgb(0 0 0 / var(--dlb-opacity));
}

/* Room for the buttons above and the caption below the photo */
[data-dlb-viewport] {
  padding: 3.5rem 0 5.5rem;
}

/* Video controls only on videos */
dialog:not([data-dlb-type="video"]) .video-bar {
  display: none;
}

/* A thin progress bar */
[data-dlb-progress] {
  height: 3px;
  background:
    linear-gradient(white, white) left / calc(var(--dlb-progress, 0) * 100%) 100% no-repeat,
    rgb(255 255 255 / 0.3);
}

/* A spinner that only shows after 400 ms of loading */
dialog[data-dlb-loading]::after {
  content: "";
  position: absolute;
  inset: 50% auto auto 50%;
  width: 2rem;
  height: 2rem;
  margin: -1rem;
  border: 2px solid rgb(255 255 255 / 0.3);
  border-top-color: white;
  border-radius: 50%;
  opacity: 0;
  animation: spin 0.8s linear infinite, appear 0s 0.4s both;
}

@keyframes spin {
  to { rotate: 1turn; }
}

@keyframes appear {
  to { opacity: 1; }
}

/* On touch screens people swipe and drag down. Hide the close button there,
   but only visually, so VoiceOver can still reach it. */
@media (pointer: coarse) {
  [data-dlb-close] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
```

## Gestures and keys

| | Mouse | Touch | Keys |
|---|---|---|---|
| Next or previous slide | Drag sideways | Swipe | ← → |
| Zoom | Click the photo | Double-tap | |
| Pan a zoomed photo | Drag | Drag | |
| Close | Click beside the photo, or on a photo that can't zoom | Drag down, or tap beside the photo | Escape |
| Hide the buttons | | Tap the photo | |
| Play or pause a video | Click it | Tap it | Space |
| Sound on or off | | | M |

## Browser support

Safari 17.4, Chrome and Edge 122, Firefox 132, and later versions (Baseline 2024).

## Development

You need [Bun](https://bun.sh).

```sh
bun install
bun run dev            # the demo at http://localhost:3000/demo/, also reachable from phones on your network
bun run test           # unit tests for the core
bun run test:browser   # Playwright in Chromium and WebKit
bun run check          # Biome and TypeScript
bun run size           # build, then check the size budget
```

## Credits

Inspired by [PhotoSwipe](https://photoswipe.com) by Dmytro Semenov. No PhotoSwipe code is used.

## License

[MIT](LICENSE)
````

- [ ] **Step 7: Humanizer pass**

Run the `humanizer:humanizer` skill in embedded mode over the prose of `README.md` and `CHANGELOG.md` (not the code blocks or tables of attribute names) and apply its result.

- [ ] **Step 8: Write the workflows**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.3
      - run: bun install --frozen-lockfile
      - run: bun run check
      - run: bun run test
      - run: bun run size
      - run: bunx --bun playwright install --with-deps chromium webkit
      - run: bun run test:browser
```

`.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: write
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.3
      # npm's trusted publishing (no stored token) needs a recent npm CLI; it only runs here, in CI.
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
      - run: bun install --frozen-lockfile
      - run: bun run check
      - run: bun run test
      - run: bun run size
      - name: Publish to npm
        run: |
          version=$(node -p "require('./package.json').version")
          if npm view "dialog-lightbox@$version" version > /dev/null 2>&1; then
            echo "dialog-lightbox@$version is on npm already"
          else
            npm publish --access public
          fi
      - run: gh release create "$GITHUB_REF_NAME" --title "$GITHUB_REF_NAME" --notes "See CHANGELOG.md."
        env:
          GH_TOKEN: ${{ github.token }}
```

The spec asked for the runners' preinstalled npm; it may be older than the version trusted publishing needs, so `actions/setup-node` provides npm 11. Locally nothing changes.

- [ ] **Step 9: Run everything**

Run: `bun run check && bun run test && bun run size && bun run test:browser`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.build.json scripts/size.ts README.md LICENSE CHANGELOG.md .github
git commit -m "Build the package, check its size, and add the README and CI" -m "bun run build writes one minified ES module, the layout CSS and the type definitions. bun run size fails above 6 kB gzipped. CI runs Biome, TypeScript, the unit tests, the size check and Playwright on every push and pull request; a v* tag publishes to npm with trusted publishing."
```

---

### Task 15: The demo with film strips

**Files:**
- Create: `demo/index.html`, `demo/demo.css`, `demo/demo.ts`, `demo/CREDITS.md`, `demo/media/*`
- Modify: `scripts/serve.ts`

**Interfaces:**
- Consumes: `lightbox` from `src/index.ts`, `src/dialog-lightbox.css`.
- Produces: `bun run dev` serves the demo at `/demo/`.

- [ ] **Step 1: Choose and download the stock media**

Pick free media and keep the originals outside the repository, in `~/Downloads/demo-sources/`:

- Six photos from Unsplash (Unsplash License), roads, coasts and northern landscapes in the spirit of a bike trip: three landscape (3:2), two portrait (2:3), and one panorama at least 3:1 with an original at least 4000 px wide. Save them as `photo-1.jpg` to `photo-6.jpg`, the panorama as `photo-6.jpg`.
- Two portrait clips from Pexels (Pexels License), 9:16, 5 to 15 seconds, one with an audible soundtrack. Save them as `clip-1.mp4` (with sound) and `clip-2.mp4`.

Use a search for each and download the original file from its page. For each file, note the page URL and the author's name.

- [ ] **Step 2: Make the demo sizes**

```bash
mkdir -p demo/media
src=~/Downloads/demo-sources
for n in 1 2 3 4 5; do
  sips -s format jpeg -s formatOptions 82 -Z 1600 "$src/photo-$n.jpg" --out "demo/media/photo-$n-1600.jpg"
  sips -s format jpeg -s formatOptions 82 -Z 1080 "$src/photo-$n.jpg" --out "demo/media/photo-$n-1080.jpg"
  sips -s format jpeg -s formatOptions 78 --resampleWidth 480 "$src/photo-$n.jpg" --out "demo/media/photo-$n-480.jpg"
done
# The panorama stays large enough to zoom into.
sips -s format jpeg -s formatOptions 82 --resampleWidth 3200 "$src/photo-6.jpg" --out demo/media/photo-6-3200.jpg
sips -s format jpeg -s formatOptions 78 --resampleWidth 720 "$src/photo-6.jpg" --out demo/media/photo-6-720.jpg
ffmpeg -v error -y -i "$src/clip-1.mp4" -t 15 -vf "scale=720:-2" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart demo/media/clip-1.mp4
ffmpeg -v error -y -i "$src/clip-2.mp4" -t 15 -vf "scale=720:-2" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -an -movflags +faststart demo/media/clip-2.mp4
for n in 1 2; do
  # The poster is the first frame, so the opening zoom matches the video's start.
  ffmpeg -v error -y -i "demo/media/clip-$n.mp4" -frames:v 1 -q:v 3 "demo/media/clip-$n-poster.jpg"
  sips --resampleWidth 480 "demo/media/clip-$n-poster.jpg" --out "demo/media/clip-$n-480.jpg"
done
rm demo/media/clip-*-poster.jpg
for f in demo/media/*.jpg demo/media/*.mp4; do
  printf '%s ' "$f"
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$f"
done
du -sh demo/media
```

Expected: the widths and heights of every file, and `demo/media` under 15 MB in total. Keep the printed widths and heights: the markup needs the `1080` and `1600` files' real widths for `srcset`, and the clips' sizes for `data-dlb-width` and `data-dlb-height`.

- [ ] **Step 3: Write `demo/CREDITS.md`**

```markdown
# Demo media

The photos and clips in `media/` are free stock media, resized and re-encoded for this demo.

| Files | Source | Author | License |
|---|---|---|---|
```

Add one row per source file (`photo-1` to `photo-6`, `clip-1`, `clip-2`) with its page URL, the author's name as shown on the page, and "Unsplash License" or "Pexels License".

- [ ] **Step 4: Write `demo/index.html`**

Every `alt` describes what the photo shows, and every caption reads "What · Where" (the place from the source page, or the subject alone when the page names no place). The `srcset` widths are the real ones printed in Step 2. Strip one shows the full markup with `srcset`; strip two shows the shortest markup, where sizes come from the thumbnails.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>dialog-lightbox demo</title>
    <link rel="stylesheet" href="../src/dialog-lightbox.css" />
    <link rel="stylesheet" href="./demo.css" />
  </head>
  <body>
    <main>
      <h1>dialog-lightbox</h1>
      <p>
        Tap a frame. Swipe between photos, double-tap or click to zoom, drag down to close. Videos play
        muted; the speaker turns the sound on.
      </p>

      <h2>With srcset</h2>
      <div class="film">
        <ul class="frames" id="one" role="list">
          <!-- photo-1 to photo-4, each like this one: -->
          <li>
            <figure>
              <a href="media/photo-1-1600.jpg" data-dlb-srcset="media/photo-1-1080.jpg 1080w, media/photo-1-1600.jpg 1600w">
                <img src="media/photo-1-480.jpg" alt="Describe photo 1" loading="lazy" />
              </a>
              <figcaption>What · Where</figcaption>
            </figure>
          </li>
          <li>
            <figure>
              <a href="media/clip-1.mp4" data-dlb-type="video" data-dlb-width="720" data-dlb-height="1280">
                <img src="media/clip-1-480.jpg" alt="Describe clip 1" loading="lazy" />
              </a>
              <figcaption>What · Where</figcaption>
            </figure>
          </li>
        </ul>
      </div>

      <h2>Without sizes</h2>
      <div class="film">
        <ul class="frames" id="two" role="list">
          <li>
            <figure>
              <a href="media/photo-5-1600.jpg"><img src="media/photo-5-480.jpg" alt="Describe photo 5" loading="lazy" /></a>
              <figcaption>What · Where</figcaption>
            </figure>
          </li>
          <li>
            <figure>
              <a href="media/photo-6-3200.jpg"><img src="media/photo-6-720.jpg" alt="Describe photo 6" loading="lazy" /></a>
              <figcaption>What · Where</figcaption>
            </figure>
          </li>
          <li>
            <figure>
              <a href="media/clip-2.mp4" data-dlb-type="video" data-dlb-audio="false">
                <img src="media/clip-2-480.jpg" alt="Describe clip 2" loading="lazy" />
              </a>
              <figcaption>What · Where</figcaption>
            </figure>
          </li>
        </ul>
      </div>
    </main>

    <dialog aria-label="Photo viewer">
      <div data-dlb-viewport></div>
      <div class="box-bar box-top">
        <span data-dlb-counter></span>
        <button type="button" data-dlb-zoom aria-label="Zoom">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-5-5M11 8v6M8 11h6" /></svg>
        </button>
        <button type="button" data-dlb-close aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <button type="button" class="box-side" data-dlb-prev aria-label="Previous">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <button type="button" class="box-side" data-dlb-next aria-label="Next">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>
      <div class="box-bar box-bottom">
        <div class="video-bar">
          <button type="button" data-dlb-play aria-label="Play">
            <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 4 13 8-13 8V4z" /></svg>
            <svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h3v16H7zM14 4h3v16h-3z" /></svg>
          </button>
          <span data-dlb-progress></span>
          <button type="button" data-dlb-mute aria-label="Sound">
            <svg class="icon-muted" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6" /></svg>
            <svg class="icon-sound" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5zM19 5a10 10 0 0 1 0 14M15.5 8.5a5 5 0 0 1 0 7" /></svg>
          </button>
        </div>
        <p class="caption"></p>
      </div>
    </dialog>

    <script type="module" src="./demo.ts"></script>
  </body>
</html>
```

Write out the `<li>` for `photo-2`, `photo-3` and `photo-4` like the one for `photo-1`, with their own files, alt texts and captions, so strip one has four photos and then the clip. Replace every "Describe …" and "What · Where" with the real text before committing.

- [ ] **Step 5: Write `demo/demo.css`**

```css
:root {
  color-scheme: light dark;
  --page: #f6f3ee;
  --text: #1d1b19;
  --film: #171513;
  --print: #e9dfc8;
  font: 16px/1.5 system-ui, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --page: #141312;
    --text: #ece7df;
  }
}

body {
  margin: 0;
  background: var(--page);
  color: var(--text);
}

main {
  max-width: 60rem;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

/* A strip of film: a dark band with sprocket holes along both edges, scrolling sideways */
.film {
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  padding: 22px 0;
  background:
    radial-gradient(circle, var(--page) 3px, transparent 3.5px) 0 4px / 14px 14px repeat-x,
    radial-gradient(circle, var(--page) 3px, transparent 3.5px) 0 calc(100% - 4px) / 14px 14px repeat-x,
    var(--film);
}

.frames {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 0 8px;
  list-style: none;
}

.frames li {
  flex: none;
  scroll-snap-align: start;
}

.frames figure {
  margin: 0;
}

.frames a {
  position: relative;
  display: block;
}

.frames img {
  display: block;
  width: 15rem;
  aspect-ratio: 3 / 2;
  object-fit: cover;
}

.frames a[data-dlb-type="video"]::after {
  content: "▶";
  position: absolute;
  inset: 50% auto auto 50%;
  translate: -50% -50%;
  color: #fff;
  font-size: 2rem;
  text-shadow: 0 1px 4px rgb(0 0 0 / 0.7);
}

.frames figcaption {
  padding-top: 4px;
  color: var(--print);
  font: 11px/1.6 ui-monospace, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* The box */
dialog[data-dlb] {
  background: transparent;
  color: #fff;
}

dialog[data-dlb]::backdrop {
  background: rgb(12 11 10 / var(--dlb-opacity));
}

[data-dlb-viewport] {
  padding: 3.5rem 0 6rem;
}

@media (min-width: 48rem) {
  [data-dlb-viewport] {
    padding-inline: 4.5rem;
  }
}

.box-bar {
  position: absolute;
  inset-inline: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem max(1rem, env(safe-area-inset-left));
  transition: opacity 0.2s;
}

.box-top {
  top: 0;
}

.box-top [data-dlb-counter] {
  margin-inline-end: auto;
  font-variant-numeric: tabular-nums;
}

.box-bottom {
  bottom: 0;
  flex-direction: column;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

dialog button {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.12);
  color: #fff;
  cursor: pointer;
}

dialog button:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.25);
}

dialog button:disabled {
  opacity: 0.3;
  cursor: default;
}

dialog svg {
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.box-side {
  position: absolute;
  top: 50%;
  translate: 0 -50%;
}

[data-dlb-prev] {
  left: 1rem;
}

[data-dlb-next] {
  right: 1rem;
}

.caption {
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.8);
}

.video-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: min(30rem, 100%);
}

dialog:not([data-dlb-type="video"]) .video-bar {
  display: none;
}

[data-dlb-progress] {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background:
    linear-gradient(#fff, #fff) left / calc(var(--dlb-progress, 0) * 100%) 100% no-repeat,
    rgb(255 255 255 / 0.25);
}

dialog[data-dlb-paused] .icon-pause,
dialog:not([data-dlb-paused]) .icon-play,
dialog[data-dlb-muted] .icon-sound,
dialog:not([data-dlb-muted]) .icon-muted {
  display: none;
}

dialog[data-dlb-ui-hidden] .box-bar,
dialog[data-dlb-ui-hidden] .box-side {
  opacity: 0;
  pointer-events: none;
}

dialog[data-dlb-zoomable] [data-dlb-current] img {
  cursor: zoom-in;
}

dialog[data-dlb-zoomed] [data-dlb-current] img {
  cursor: zoom-out;
}

dialog[data-dlb-error] .caption::before {
  content: "This photo could not be loaded. ";
}

/* A spinner that only shows after 400 ms of loading */
dialog[data-dlb-loading]::after {
  content: "";
  position: absolute;
  inset: 50% auto auto 50%;
  width: 2rem;
  height: 2rem;
  margin: -1rem;
  border: 2px solid rgb(255 255 255 / 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  opacity: 0;
  animation: spin 0.8s linear infinite, appear 0s 0.4s both;
}

@keyframes spin {
  to {
    rotate: 1turn;
  }
}

@keyframes appear {
  to {
    opacity: 1;
  }
}

/* Touch screens: swipe instead of arrows, and the close button only for screen readers */
@media (pointer: coarse) {
  .box-side {
    display: none;
  }

  [data-dlb-close] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
```

- [ ] **Step 6: Write `demo/demo.ts` and serve the demo**

`demo/demo.ts`:

```ts
import { lightbox } from "../src/index";

const dialog = document.querySelector("dialog")!;
const caption = dialog.querySelector<HTMLElement>(".caption")!;

for (const gallery of document.querySelectorAll<HTMLElement>(".frames")) {
  const box = lightbox({ gallery, dialog });
  box.on("change", ({ link }) => {
    caption.textContent = link.closest("figure")?.querySelector("figcaption")?.textContent?.trim() ?? "";
  });
}
```

In `scripts/serve.ts`, add the import and the route, and print both addresses:

```ts
import demo from "../demo/index.html";
```

```ts
  routes: { "/demo/": demo, "/test/browser/": fixture },
```

```ts
console.log(`Demo: http://localhost:${server.port}/demo/`);
console.log(`Test fixture: http://localhost:${server.port}/test/browser/`);
```

(The last two lines replace the existing `console.log`.)

- [ ] **Step 7: Check the demo**

Run: `bun run dev`, then open `http://localhost:3000/demo/` in Chrome and in Safari on the Mac. Check: the strips scroll sideways; a click opens with the zoom out of the frame; arrows, Escape, zoom by click and pan work; both clips play muted, the sound button works on clip 1 and is disabled on clip 2; the progress bar moves; the caption matches the frame; closing zooms back into the frame.

Run: `bunx biome check --write . && bun run check && bun run test:browser`
Expected: no errors, all tests still pass.

Then ask Max to open `http://<address from ipconfig getifaddr en0>:3000/demo/` on his iPhone.

- [ ] **Step 8: Commit**

```bash
git add demo scripts/serve.ts
git commit -m "Add a demo with two film strips" -m "Free stock photos and clips (credited in demo/CREDITS.md) in a simplified version of the portfolio's film look. The dialog uses every element the library knows, styled in demo.css: buttons with icons, caption, progress bar, delayed spinner, and a close button that is only hidden visually on touch screens."
```

---

### Task 16: GitHub, real devices and the 0.1.0 release

**Files:**
- Modify: `package.json` (version), `CHANGELOG.md` (date)

- [ ] **Step 1: Create the repository (ask Max first)**

Ask Max whether to create the public repository `maxfettinger/dialog-lightbox` and push. Only after a yes:

```bash
gh repo create maxfettinger/dialog-lightbox --public --description "A lightweight lightbox on the native <dialog>: swipe, zoom, video." --source . --remote origin
git push -u origin main
git push -u origin first-version
```

- [ ] **Step 2: Open the pull request**

Write the description with the humanizer skill (embedded mode). It says what the branch contains: the pure core and its unit tests, the DOM shell and its Playwright tests, the demo, the size from `bun run size`, and that real-device checks follow. Then:

```bash
gh pr create --base main --head first-version --title "First version of dialog-lightbox" --body-file <file with the description>
gh pr checks --watch
```

Expected: CI passes. If only the video specs fail, and only in WebKit on Linux, because the runner's WebKit can't play either test clip, add `test.skip(browserName === "webkit" && process.platform === "linux", "no video codecs in WebKit on Linux CI")` at the top of `test/browser/video.spec.ts` (with `browserName` from the test's arguments) and tell Max. Any other failure is a bug to fix with a test first.

- [ ] **Step 3: Real devices (with Max)**

With `bun run dev` running, Max goes through the spec's list (section 14) on `http://<address>:3000/demo/`:

- iPhone Safari: normal and Low Power Mode, opened by tap and by keyboard; sound on, then swipe to the next video; the silent switch; no black flash on open and close; a long press shows no menu; swipe and drag down on a full-screen portrait clip; the clip without audio; switching apps and coming back; back and forward cache; swiping fast through many videos; no page scroll behind the box.
- Android Chrome, if a phone is at hand: muted autoplay, the media notification with sound on, rotation, Data Saver, fast swipes without console errors, no pull-to-refresh.
- Desktop Safari with autoplay blocked, Firefox with audio and video blocked, Chrome: paused state and click to play, Space on the focused play button toggles once, M, arrows, Escape, a slow network (DevTools throttling) and the spinner delay, a broken link and `data-dlb-error`.

Each problem gets a failing test where a test can show it, then the fix, then a commit on `first-version` and a push.

- [ ] **Step 4: Merge (ask Max first)**

```bash
gh pr merge --merge --delete-branch
git switch main
git pull
```

- [ ] **Step 5: Release 0.1.0 (with Max)**

1. Set `"version": "0.1.0"` in `package.json` and replace "(unreleased)" in `CHANGELOG.md` with the date. Commit with the message "Release 0.1.0", then ask Max before pushing to `main`.
2. Max needs an npm account with two-factor authentication. npm can only set up trusted publishing for a package that exists, so the first version goes up by hand: Max creates a short-lived granular access token on npmjs.com with publish rights and runs, in this session's prompt so the token stays out of the transcript:
   ```
   ! NPM_CONFIG_TOKEN=<his token> bun publish --access public
   ```
   Expected: `dialog-lightbox@0.1.0` is published.
3. Max opens the package's settings on npmjs.com, adds a trusted publisher (GitHub Actions, repository `maxfettinger/dialog-lightbox`, workflow `release.yml`) and deletes the token.
4. After Max's yes, tag and push:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
   Expected: the release workflow passes; it skips publishing because 0.1.0 is on npm already, and creates the GitHub release.
5. Check:
   ```bash
   curl -s https://registry.npmjs.org/dialog-lightbox | jq '."dist-tags"'
   gh release view v0.1.0
   ```
   Expected: `{"latest": "0.1.0"}` and the release page.

From 0.1.1 on, a version bump, a changelog entry and a `v*` tag are enough; the workflow publishes.

---

## Spec coverage

| Spec section | Tasks |
|---|---|
| 6.1 links, size resolution, ids | 4, 7 |
| 6.2 dialog elements | 7 (close, counter), 8 (prev, next), 10 (zoom), 11 (play, mute, progress) |
| 6.3 JavaScript API and events | 7, 8, 11, 13 |
| 6.4 state attributes, `--dlb-opacity`, `--dlb-progress` | 7, 9, 11, 12 |
| 7.1 opening, placeholder, crop, fade, reduced motion, preloading, hover | 7, 9, 13 |
| 7.2 closing, scroll into view, focus, Escape fallback | 7, 9 |
| 7.3 navigation, ends, loop | 1, 8 |
| 7.4 gestures and zoom | 2, 3, 5, 10, 12 |
| 7.5 video | 6, 11, 12 (tap) |
| 7.6 back button and deep links | 13 |
| 7.7 loading and errors | 7, 11 |
| 7.8 accessibility | 7, 8, 11 |
| 8 architecture | all |
| 9 CSS | 7 |
| 10 size budget | 14 |
| 11 browser support | 1 (no polyfills), 7 (Chromium and WebKit) |
| 12 tooling | 1, 7, 14 |
| 13 repository, releases, license | 14, 16 |
| 14 testing | 1 to 13, 16 |
| 15 demo | 15 |
| 17 risks | 12 (iPhone check), 9 (animation), 14 (CI), 7 (Escape fallback) |
