# dialog-lightbox: design

Date: 2026-10-15. Status: approved by the owner on 2026-10-15.

## 1. Summary

`dialog-lightbox` is a lightweight lightbox for photos and short videos, built on the native `<dialog>`
element. It adds behavior only: opening and closing with a zoom from the thumbnail, swiping, zooming,
dragging down to close, video playback, the back button. The page that uses it writes all markup and all
CSS. The library finds the page's elements by `data-dlb-*` attributes, wires them up and reports its state
back as attributes the page can style.

The first user is the Hugo portfolio at `~/dev/portfolio-hugo` (the film strips), which uses PhotoSwipe
5.4.4 today. The library is public on GitHub and npm from the start, with a deliberately small feature
set.

Subtitle for README and npm: "A lightweight lightbox on the native `<dialog>`: swipe, zoom, video. It adds
behavior; the markup and CSS stay yours."

## 2. Goals and non-goals

Goals:

- Small: at most 6 kB min+gzip for the script, no runtime dependencies.
- Behavior only: the library ships no visual styles and creates no buttons.
- Typed: TypeScript `strict`, types published with the package.
- Feels like a native photo app on phones (Apple Photos is the reference) and works with mouse and
  keyboard on desktop.
- Pure, testable core: the decisions (gestures, geometry, zoom, motion, video state) are plain functions
  without the DOM.
- Only what the portfolio needs now. Section 16 lists what was left out.

Non-goals:

- No plugin system, no event filters, no options for things CSS can do.
- No inline gallery or carousel. PhotoSwipe's author says the same for v6: use CSS scroll snap for that.
- No data source other than links in the DOM.
- No support for browsers older than Baseline 2024 (section 11).
- No framework adapters. A custom player or UI can be built on the events and `lb.video`.

## 3. Context

Reference material lives in `context/` (local only, gitignored):

- `context/photoswipe/`: PhotoSwipe 5.4.4 source, for ideas. No code is copied (section 13).
- `context/photoswipe-v6-plans.md`: the author's v6 plans. They point the same way: headless core,
  separate UI, `<dialog>`, TypeScript, modern browser APIs only.
- `context/portfolio-usecase/`: how the portfolio uses PhotoSwipe today.

Problems with today's setup that this design fixes:

- Videos: PhotoSwipe's video plugin uses native `controls` and guesses that only the bottom 40 px of a
  video are controls. On desktop, clicks on the native scrubber and volume get swallowed. On iPhone,
  Safari's controls and PhotoSwipe's buttons overlap on full-screen portrait clips, and there is nowhere
  left to swipe. Fixed by owning all gestures and never using native `controls` (section 7.5).
- Looping at the ends is unwanted. Fixed by `loop: false` as the default.
- `.pswp video { max-inline-size: none }` was needed because a CSS reset shrank the video to 0 px. Fixed
  by setting geometry inline from the script (section 9).
- The core was lazy-loaded with `import()`. Safari probably drops the user gesture across that await,
  which blocks video playback. The library is small enough to load with the page (section 7.5).

## 4. Terms

- Gallery: an element whose `<a href>` links are the slides, in DOM order. One per film strip.
- Slide: one photo or video in the box. At most three slide elements exist at once: previous,
  current, next.
- Viewport: the `[data-dlb-viewport]` element in the dialog. Slides live inside it, and gestures
  start on it.
- Fit: the largest size at which the whole photo fits inside the viewport's content box.
- Zoomable: a photo whose zoom target is at least 1.2 times its fit size.
- Core: pure functions in `src/core/`. Shell: the DOM code in `src/dom/` that calls them.
- Intent: what the gesture state machine decides a pointer sequence means (tap, swipe, pan...).

## 5. Decisions and why

| Decision | Why |
|---|---|
| Native `<dialog>` with `showModal()` | Focus trap, inert page, Escape and top layer come from the browser. |
| Consumer writes the dialog markup | All styling stays in the page; a React or Svelte UI is just different markup. |
| Functional core and thin DOM shell, no classes | Every decision can be unit-tested without a browser, and the shell stays short. |
| No gesture library | None fits a pure state machine, and the smallest usable one is over the size budget alone. |
| One reusable `<video>` per lightbox | iOS unlocks playback per element after one gesture, decoders and memory stay low, and a custom player binds once. |
| No native video `controls` | They overlap the page's UI and fight the swipe gestures (see section 3). |
| No lazy loading of the library | Keeps the opening click a user gesture, so video can start. 6 kB is cheap. |
| Fit area comes from the viewport's CSS padding | Room for the caption and buttons is set in CSS, with media queries, without a JS option. |
| Sizes fall back to the thumbnail and srcset | `data-dlb-width`/`height` become optional, so the Hugo markup stays short. |
| Gestures start only on the viewport | The page's buttons sit outside it in the DOM, so they never start a swipe. No exclusion attribute is needed. |
| Bun as the only local tool | One runtime for install, scripts, unit tests and bundling; Playwright runs on it since Bun 1.4. |
| MIT license, credit to PhotoSwipe in the README | The design borrows ideas from PhotoSwipe and copies no code from it. |

## 6. Public API

### 6.1 Links (the gallery)

Every `<a href>` inside the gallery element is a slide. The first `<img>` inside the link is its
thumbnail.

| Attribute | Required | Meaning |
|---|---|---|
| `href` | yes | Large image, or the video file. Without JavaScript the link opens it. |
| `data-dlb-type="video"` | for videos | Marks a video slide. The thumbnail is its poster. |
| `data-dlb-srcset` | no | `srcset` for the large image. The largest `w` descriptor is taken as the photo's native width. |
| `data-dlb-width`, `data-dlb-height` | no | Native size. Overrides the fallbacks below. |
| `data-dlb-id` | no | Stable id for deep links. |
| `data-dlb-noaudio` | no | The video has no audio track; the mute button is disabled. |

Size resolution, in order:

1. `data-dlb-width` and `data-dlb-height`.
2. Aspect ratio from the thumbnail's `naturalWidth`/`naturalHeight`, native width from the largest
   `srcset` descriptor (or unknown).
3. Measured from the large image or video metadata after loading. Until then the slide shows a loading
   state and opens with a fade instead of the zoom.

Thumbnails must show the whole photo. A crop to the frame is done in CSS with `object-fit: cover`, which
the library detects and animates (section 7.1). Server-cropped thumbnails give wrong aspect ratios.
`object-position` is assumed to be the center.

Slide ids: `data-dlb-id` if present, otherwise `<gallery id>-<n>` with `n` counting from 1. A gallery
without an `id` attribute gets `g<k>`, where `k` is the order of `lightbox()` calls on the page.

### 6.2 The dialog

Only the viewport is required. Every other element is optional; when it is missing, its feature still
works through gestures and keys.

| Element | The library |
|---|---|
| `[data-dlb-viewport]` | Puts the slides inside. Gestures start here. Its CSS padding defines the fit area. |
| `[data-dlb-close]` | Closes on click. |
| `[data-dlb-prev]`, `[data-dlb-next]` | Go to the previous or next slide; `disabled` at the ends unless `loop`. |
| `[data-dlb-zoom]` | Toggles zoom; `disabled` when the slide is not zoomable; `aria-pressed` when zoomed. |
| `[data-dlb-counter]` | Gets the text "3 / 16". |
| `[data-dlb-play]` | Toggles play; `aria-pressed` while playing. |
| `[data-dlb-mute]` | Toggles sound; `aria-pressed` while muted; `disabled` for videos without audio. |
| `[data-dlb-progress]` | Gets `--dlb-progress` (0 to 1) while a video plays, for a thin progress bar. |

Example (Hugo partial):

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
    <button data-dlb-mute aria-label="Sound off">…</button>
  </div>
  <p class="caption"></p>
</dialog>
```

### 6.3 JavaScript

```ts
import { lightbox } from "dialog-lightbox";
import "dialog-lightbox/dialog-lightbox.css";

const lb = lightbox({
  gallery: track,        // HTMLElement
  dialog,                // HTMLDialogElement, may be shared by several galleries
  loop: false,           // optional, default false
  history: true,         // optional, default true: back button closes, #dlb=<id> opens
});

lb.on("change", (slide) => {
  caption.textContent = captionFor(slide.link);
});
```

```ts
interface LightboxOptions {
  gallery: HTMLElement;
  dialog: HTMLDialogElement;
  loop?: boolean;
  history?: boolean;
}

interface Slide {
  index: number;
  id: string;
  type: "image" | "video";
  link: HTMLAnchorElement;
}

interface Lightbox {
  open(index?: number): void;
  close(): void;
  goTo(index: number): void;
  next(): void;
  prev(): void;
  readonly current: Slide | null;   // null while closed
  readonly count: number;
  readonly video: HTMLVideoElement; // the one reusable video element
  on(type: "open" | "change" | "close", handler: (slide: Slide) => void): () => void;
  destroy(): void;
}
```

Events:

- `open`: the dialog is open and the first slide is known, before the opening animation.
- `change`: the current slide changed, including once right after `open`. This is where captions go.
- `close`: the dialog has closed and the closing animation has finished.

`open()` without an index opens the first slide; calling it while open does nothing. `goTo()`, `next()`
and `prev()` do nothing while closed. `destroy()` closes the box without animation if it is open,
removes every listener and leaves the page's markup as it was.

`on()` returns a function that removes the handler. `lb.video` exists from the start, so the page can
configure it once, for example `lb.video.loop = false`, or attach its own player to it.

Several galleries may share one dialog. Only one is open at a time; it binds the dialog's elements when
it opens and unbinds them when it closes (one `AbortController` per open session).

Links are read again on every open, so galleries that change after `lightbox()` still work.

`lightbox()` throws an `Error` with a clear message when the dialog has no `[data-dlb-viewport]`.

### 6.4 State for CSS

On the dialog:

| Attribute | Set when |
|---|---|
| `data-dlb` | Always (set by `lightbox()`; the library's CSS uses it). |
| `data-dlb-type="image\|video"` | Type of the current slide. |
| `data-dlb-first`, `data-dlb-last` | The current slide is the first or last. |
| `data-dlb-loading` | The current photo is not decoded yet, or the video is buffering. |
| `data-dlb-error` | The current photo or video failed to load. |
| `data-dlb-zoomable`, `data-dlb-zoomed` | The current photo can zoom, or is zoomed. |
| `data-dlb-ui-hidden` | The UI was hidden by a tap. |
| `data-dlb-paused`, `data-dlb-muted`, `data-dlb-noaudio` | Video state. |

On slides: `data-dlb-slide` on every slide element, `data-dlb-current` on the current one.

Custom properties:

- `--dlb-opacity` (0 to 1) on the dialog: 1 when fully open, animated on open and close, and following
  the finger while dragging down. Meant for the backdrop, for example
  `dialog[data-dlb]::backdrop { background: rgb(0 0 0 / var(--dlb-opacity)) }`.
- `--dlb-progress` (0 to 1) on `[data-dlb-progress]` elements only, not on the dialog, so the whole
  subtree does not restyle on every frame.

## 7. Behavior

Durations and curves:

- Open, close, zoom, and slide changes by key or button: 300 ms. Open, close and zoom use
  `cubic-bezier(.4, 0, .22, 1)`; slide changes use the spring below with no start velocity.
- After a swipe: a critically damped spring (ω = 30), settling in about 250 ms, starting with the release
  velocity.
- After a pan or a cancelled drag down: a critically damped spring (ω = 12).
- Springs are computed when they start and played with the Web Animations API as a CSS `linear()` easing
  of about 30 stops.
- An animation interrupted by a new pointer is cancelled, and the gesture continues from the element's
  current computed transform.

### 7.1 Opening

1. A click on a gallery link opens the box. Clicks with Ctrl, Cmd, Shift or Alt and non-primary buttons
   keep their normal behavior.
2. `showModal()`, then the `open` and `change` events.
3. The current slide is built. Its media show the thumbnail's image right away (it is already loaded) as
   a placeholder. The large image is loaded off-DOM, decoded, and then placed on top.
4. Zoom animation: the media start exactly over the thumbnail and grow to the fit rectangle. If the
   thumbnail uses `object-fit: cover`, the media start as large as the whole photo would be at the
   thumbnail's scale and are clipped (`clip-path: inset()`) to the thumbnail's box; the clip opens while
   they grow. `--dlb-opacity` goes from 0 to 1 at the same time.
5. The thumbnail is hidden (`visibility: hidden`) during the animation and shown again afterwards.
6. A fade is used instead of the zoom when the thumbnail has no size on screen or the photo's size is
   still unknown. With `prefers-reduced-motion: reduce` there is no animation.
7. After the current photo is decoded, the previous and next slides start loading.
8. Hovering a link with a mouse starts loading its large image early.

### 7.2 Closing

Triggers: the close button, Escape, a tap or click outside the media, dragging down, the back button.

1. The current slide's link is scrolled into view (`block` and `inline` set to `nearest`, no smooth
   scroll), so the closing zoom always lands on the right thumbnail, even after swiping to a photo that
   was off-screen in the strip.
2. The reverse zoom runs from wherever the media are (fit, zoomed, or mid-drag) to the thumbnail.
   A fade is used when the thumbnail has no size on screen.
3. `dialog.close()`, focus moves to the current slide's link, then the `close` event.

Escape: the library calls `preventDefault()` on the dialog's `cancel` event and runs the animated close.
Browsers may make `cancel` non-cancelable (for example after repeated Escape presses without other user
activation); then the dialog closes at once, and the library cleans up in the `close` event without an
animation.

### 7.3 Navigation

- Slide elements sit side by side, each a viewport width plus a 10% gap apart, moved with `transform`.
- Arrow keys and the prev/next buttons change the slide with the 300 ms slide animation.
- At the first and last slide without `loop`, the buttons are disabled and keys do nothing. Dragging
  past the end follows the finger with resistance and springs back.
- With `loop: true`, the last slide's next is the first and the reverse.

### 7.4 Gestures and zoom

Pointer handling:

- Listeners are on the viewport only. `touch-action: none` on the viewport removes browser panning,
  pinch-zoom and the double-tap delay.
- `setPointerCapture` on `pointerdown`. Only one pointer counts in v1: a second pointer cancels the
  current gesture and the slide springs back. `pointercancel` does the same, without a tap.
- Velocity comes from the last 100 ms of samples, using `event.timeStamp`.
- During a drag, transforms are written once per animation frame from the latest pointer position.
- Images get `draggable="false"` so desktop browsers don't start a native image drag.

Recognition (the core state machine):

- Movement under 10 px from the start is a tap candidate. Above 10 px the axis with more movement wins
  and stays locked for the rest of the gesture.
- Horizontal: swipe between slides, or pan when zoomed.
- Vertical: drag down to close, or pan when zoomed. Dragging up does nothing in v1 (kept free for later).
- A tap is under 10 px and under 300 ms. A double tap is a second tap within 300 ms and 30 px of the
  first.

What a tap or click does:

| Where | Mouse click | Touch tap | Touch double tap |
|---|---|---|---|
| Photo, zoomable | Toggle zoom | Toggle UI, after waiting 300 ms for a second tap | Toggle zoom |
| Photo, not zoomable | Close | Toggle UI at once | Two separate taps |
| Photo, zoomed | Zoom out to fit | Toggle UI (after the wait) | Zoom out to fit |
| Video | Play or pause | Play or pause at once | Two separate taps |
| Viewport outside the media | Close | Close | Close |

Swipe:

- Commits to the next or previous slide when the horizontal velocity is above 0.5 px/ms in that
  direction, or the drag is more than half the viewport width.
- Otherwise springs back.
- Past the ends, resistance follows `(1 − 1 / (x · 0.55 / W + 1)) · W`, with `x` the drag distance past
  the end and `W` the viewport width.

Drag down to close:

- The media follow the finger in x and y. With `p = dy / (viewport height / 3)`, clamped to 0..1, the
  media scale to `1 − 0.2 · p` and `--dlb-opacity` is `1 − p`.
- On release, the box closes when `dy + 199 · vy` exceeds 13% of the viewport height (`vy` in px/ms);
  otherwise everything springs back.

Zoom:

- Zoom target: `min(native width / fit width, 3)` times the fit size. A photo is zoomable when this
  target is at least 1.2; otherwise zoom is off (no zoom cursor, the zoom button disabled). If the native
  width is unknown, zoomability is decided once the large image has loaded.
- Zooming in keeps the tapped or clicked point under the pointer, then clamps to the pan bounds. Zooming
  out always returns to fit. The zoom button zooms around the center.
- When a zoom animation ends, the media's width and height are set to the zoomed size with scale 1, so
  the browser draws sharp pixels, and `sizes` is raised so `srcset` picks the larger file.
- While zoomed, a drag pans: 1:1 inside the bounds, with the same resistance formula outside them. On
  release the position is projected (`v · 199` per axis, in px), clamped to the bounds, and reached with
  the ω = 12 spring.
- Edge handoff: when a pan starts with the photo already at its left or right bound and moves outward,
  the gesture becomes a swipe to the next slide (as in Apple Photos).
- Changing the slide or resizing the window resets zoom to fit.
- Not in v1: pinch, wheel and trackpad zoom. The view state is `{ scale, x, y }`, so they can be added
  without changing it.

Window resize and rotation: a `ResizeObserver` on the viewport recomputes fit and slide positions.

### 7.5 Video

Element and lifecycle:

- Each lightbox owns one `<video>` element (`lb.video`), created by `lightbox()` with the `muted`
  property set before any `src`, plus `playsinline`, `loop`, `preload="metadata"`,
  `disablepictureinpicture` and `disableremoteplayback`. No `controls`.
- A video slide that is not current shows only its poster (the thumbnail's image). When it becomes
  current, the video element moves into that slide, gets the slide's `src` (the attribute, not a
  `<source>`), and `play()` is called synchronously inside the event that caused the change (the opening
  click, the swipe's `pointerup`, the key or button), so it counts as a user gesture.
- The video stays invisible above its poster until its first frame is painted
  (`requestVideoFrameCallback`), so there is no black flash.
- Leaving a video slide pauses it. Leaving for a photo, or closing, also releases it
  (`removeAttribute("src")` and `load()`), which stops the download.
- The opening zoom animates the poster. Closing animates the paused video's slide; if that turns out to
  stutter on an iPhone, video slides close with a fade instead.

State (the core's video state machine; media events are the source of truth, so a custom player that
calls `play()` itself stays in sync):

```
idle ──activate──▶ starting ──playing──▶ playing ◀──▶ paused
starting ──NotAllowedError──▶ (sound on? mute and retry once) : paused
playing ──page hidden──▶ suspended ──page visible──▶ starting
any ──error──▶ error          any ──deactivate / close──▶ idle
waiting ⇄ playing toggles data-dlb-loading
```

Rules:

- `AbortError` from `play()` is ignored (it means a newer `pause()` or `load()` interrupted it).
- Mute is a property of the lightbox, carried from video to video while the page is open. Turning sound
  on happens only inside a click or key handler, because WebKit pauses videos that are unmuted without a
  gesture.
- No volume slider: iOS doesn't let scripts set the volume.
- Autoplay is skipped when `navigator.connection?.saveData` is true; the slide starts paused.
- `--dlb-progress` is updated from `requestVideoFrameCallback` while playing.
- Keys on video slides: Space toggles play, M toggles sound. Keys are ignored when their target is a
  button or a form field, so Space on a focused button doesn't toggle twice.

### 7.6 Back button and deep links (`history: true`)

- Opening adds one history entry with the URL `#dlb=<id>`. Slide changes replace that entry, so the back
  button closes the box instead of stepping through slides.
- Closing by any other means calls `history.back()` to remove the entry again. The `popstate` that
  follows is ignored because the box is already closing.
- A `popstate` while the box is open closes it.
- On `lightbox()`, if the URL hash is `#dlb=<id>` and the id belongs to this gallery, the box opens on
  that slide with a fade. In this case no entry was pushed, so closing replaces the URL without the hash
  instead of going back.

### 7.7 Loading and errors

- `data-dlb-loading` while the current photo decodes or the video buffers. The page's CSS should delay
  its spinner by about 400 ms so it only shows on real waits.
- A photo or video that fails to load sets `data-dlb-error` while it is the current slide. A failed photo
  keeps showing its thumbnail. There are no retries.
- Only programming mistakes (a dialog without a viewport) throw, and only from `lightbox()`.

### 7.8 Accessibility (minimal)

- `showModal()` traps focus and makes the page inert; focus returns to the current slide's link.
- The large image takes the thumbnail's `alt`. Slides that are not current get `aria-hidden="true"`.
- Buttons get `disabled` and `aria-pressed` as listed in section 6.2. Labels are the page's job.
- Keys: left and right arrows, Escape, Space and M on videos.
- `prefers-reduced-motion: reduce` turns all animations into instant changes. Dragging still follows
  the finger.
- The README recommends hiding the close button on touch screens only visually, so VoiceOver users can
  still reach it.

## 8. Architecture

```
          page markup + CSS (consumer)
                    ▲  state attributes, --dlb-* properties
                    │
DOM events ──▶  shell (src/dom)  ──▶ styles, WAAPI animations, history, video element
                    │  ▲
          inputs    ▼  │  results (new state, intents, effects)
                core (src/core)   pure functions, no DOM, no timers
```

The shell owns one state object per lightbox and passes it with each input to the core; the core
returns new state plus what should happen. Timers (the 300 ms tap wait) are effects the shell runs and
reports back as an input.

Files:

```
src/
  index.ts           exports lightbox() and the public types
  core/
    geometry.ts      fit in a padded box, cover-crop start rect and clip insets, zoom target,
                     zoom around a point, pan bounds
    navigation.ts    next and previous index with or without loop, neighbours
    gesture.ts       pointer state machine: slop, axis lock, tap and double tap, velocity, intents
    motion.ts        spring solver to linear() stops, release projection, resistance curve
    video.ts         video state machine: step(state, event) returns state and effects
  dom/
    lightbox.ts      lightbox(): state, wiring, open and close sessions
    slides.ts        slide elements, placeholders, image loading and decoding, preloading
    animate.ts       open, close, slide, zoom and spring animations with WAAPI
    controls.ts      binding data-dlb-* elements, state attributes, keys
    video.ts         the video element: events, play and pause, reveal, progress
    history.ts       hash entry, popstate, deep link on start
  dialog-lightbox.css  structure only (section 9), copied to dist/ by the build
```

Rules for the code:

- `core/` never touches `document`, `window`, timers or the clock; time comes in with the inputs.
- Functions and plain objects, no classes. Discriminated unions for inputs, intents and effects.
- Every listener of an open session is registered with that session's `AbortSignal`, so closing removes
  them all in one call.
- No dependency at runtime.

## 9. The library's CSS

`dialog-lightbox.css`, about 20 lines, layout only, no colors or fonts:

- `@property --dlb-opacity` (`<number>`, inherited, initial 1), so the property can be animated.
- In `@layer dialog-lightbox`:
  - `html:has(dialog[data-dlb][open])`: `overflow: hidden; scrollbar-gutter: stable` (scroll lock; a
    dialog alone does not stop the page from scrolling on iOS).
  - `dialog[data-dlb]`: full viewport (`inset: 0`, `width: 100%`, `height: 100dvh`, no max sizes, margin,
    padding or border), `overscroll-behavior: contain`.
  - `[data-dlb-viewport]`: `position: absolute; inset: 0; overflow: hidden; touch-action: none;
    user-select: none; -webkit-touch-callout: none`.
  - `[data-dlb-slide]`: `position: absolute; inset: 0`.

Everything geometry depends on (width, height, `transform`, `max-width: none` on media) is set inline by
the script, so resets like `img { max-inline-size: 100% }` in a page's CSS layers cannot break it.

## 10. Size budget

- `dist/dialog-lightbox.js`, minified and gzipped: at most 6 kB. Checked in CI.
- `dist/dialog-lightbox.css`: at most 1 kB uncompressed.
- Rough estimate: gestures, geometry and motion about 1.8 kB; video about 1.1 kB; the rest of the shell
  about 2.5 kB.

## 11. Browser support

Baseline 2024: Safari 17.4, Chrome and Edge 122, Firefox 132 and later. Needed for `@property`
(animating `--dlb-opacity`), custom properties inherited by `::backdrop`, and
`requestVideoFrameCallback`, alongside older Baseline features: `<dialog>`, Pointer Events, the Web
Animations API, `linear()`, `:has()`, `dvh`.

## 12. Tooling and project layout

- Bun (installed with Homebrew, Brewfile updated) for installing, scripts, unit tests and bundling.
  No Node needed locally.
- TypeScript, current major, `strict`. `tsc --emitDeclarationOnly` writes the `.d.ts` files.
- `bun build` writes one minified ES module, `dist/dialog-lightbox.js`.
- Biome for formatting and linting.
- Playwright (on Bun) for browser tests, with Chromium and WebKit.

```
src/                    library source (section 8)
test/unit/              bun test, one file per core module
test/browser/           Playwright tests
demo/                   index.html, demo.css, demo.ts, media/, CREDITS.md
docs/superpowers/       specs and plans
context/                local reference, gitignored
dist/                   build output, gitignored
package.json  tsconfig.json  biome.json  playwright.config.ts
README.md  LICENSE  CHANGELOG.md  .github/workflows/
```

`package.json` essentials: `"type": "module"`, `exports` for `.` (types and the script) and
`./dialog-lightbox.css`, `"files": ["dist"]`, `"sideEffects": ["*.css"]`, no `dependencies`.

## 13. Repository, releases, license

- Public GitHub repository `dialog-lightbox`. The local folder can stay `lightweight-box`.
- MIT license in the name of Maximilian Fettinger. The README says "Inspired by PhotoSwipe by Dmytro
  Semenov" with a link. No PhotoSwipe code is copied. If a function ever is ported line by line, it gets
  PhotoSwipe's MIT notice in its header and in a third-party section of `LICENSE`.
- The README covers installing, the markup contract, the JS API, the state attributes, and CSS recipes:
  the backdrop with `--dlb-opacity`, the caption, a progress bar, a delayed spinner, and hiding the close
  button visually on touch screens. README, commit messages and pull requests are written with the
  humanizer skill.
- Work happens on feature branches with pull requests into `main`. Nothing is committed, pushed or
  created on GitHub without asking first.
- CI (GitHub Actions, `oven-sh/setup-bun`) on every push and pull request: Biome, `tsc`, `bun test`,
  Playwright (Chromium and WebKit), build and size check.
- Releases: version in `package.json`, `CHANGELOG.md` by hand, a `v*` tag. A release workflow tests,
  builds and publishes to npm with trusted publishing (no stored token, provenance attached), using the
  npm CLI that GitHub's runners have preinstalled. If npm requires the package to exist before a trusted
  publisher can be set up, `0.1.0` is published once by hand with `bun publish`.
- The first release is `0.1.0`.

## 14. Testing

Unit tests (`bun test`), for the core:

- geometry: fit with padding, cover crop start rect and insets, zoom target and the 1.2 threshold, zoom
  around a point, pan bounds.
- navigation: ends with and without loop, galleries of one and two slides.
- gesture: recorded pointer sequences for tap, double tap, the tap wait only on zoomable photos, swipe
  commit by velocity and by distance, snap back, axis lock, drag down commit and cancel, pan, edge
  handoff, second pointer, `pointercancel`.
- motion: spring stops, projection, resistance.
- video: every transition in the state machine, including the muted retry and `AbortError`.

Browser tests (Playwright, Chromium and WebKit, a phone-sized viewport with touch): open and close by
click, button, Escape, drag down and outside tap; focus return; swipe and keys; ends and loop; double tap
zoom and pan; video autoplay muted, tap to pause, mute, `--dlb-progress`; back button and deep link;
`data-dlb-error`; reduced motion. Touch gestures are simulated by dispatching `PointerEvent`s with
`pointerType: "touch"`, which tests the library's logic in both engines. How it feels is checked on a
real phone.

Real devices, before `0.1.0`:

- iPhone Safari: normal and Low Power Mode, opened by tap and by keyboard; sound on, then swipe to the
  next video; silent switch; no black flash on open and close; long press shows no menu; swipe and drag
  down on a full-screen portrait clip; video without audio; switching apps and coming back; back and
  forward cache; fast swiping through many videos; no page scroll behind the box.
- Android Chrome: muted autoplay, media notification with sound on, rotation, Data Saver, fast swipes
  without errors in the console, no pull-to-refresh.
- Desktop Safari (autoplay blocked), Firefox (audio and video blocked), Chrome: paused state and click
  to play, Space on the focused play button toggles once, M, arrows, Escape, slow network and the
  spinner delay, a broken link and `data-dlb-error`.

## 15. Demo

`demo/index.html`, served with Bun's built-in dev server and reachable from a phone on the local
network:

- Two film strips in a simplified version of the portfolio's film look, each its own gallery, sharing one
  dialog.
- The dialog with every element from section 6.2, styled in `demo/demo.css`: backdrop with
  `--dlb-opacity`, caption from the `<figure>`, thin video progress bar, delayed spinner, close button
  hidden visually on touch screens.
- Media: free stock photos and clips (Unsplash and Pexels), with sources and licenses in
  `demo/CREDITS.md`. Chosen as test material: landscape and portrait photos, one very wide photo for
  zooming, one 9:16 clip with sound and one without.
- Built at the end, after the library works, so the owner can try everything.

## 16. Deferred (not in v1)

- Pinch zoom, mouse wheel and trackpad zoom, swipe up.
- Video scrubber and time display, native fullscreen handoff, hold to pause, remembering sound across
  page loads.
- HTML or iframe slides, a JavaScript array as data source, virtualization.
- Plugins, framework adapters, a web component wrapper, right-to-left layouts, thumbnail navigation.
- `object-position` other than center for cropped thumbnails.
- A hosted demo on GitHub Pages.
- Switching the portfolio from PhotoSwipe to this library. That is its own project afterwards, including
  `data-dlb-noaudio` from `prepare-photos.py`.

## 17. Risks to check early

- Whether iOS keeps the user gesture for `play()` and for sound after a swipe, with one reused video
  element. Checked in the first video milestone on a real iPhone, not at the end.
- Smoothness of the `clip-path` plus `transform` opening animation with large photos on older iPhones.
- Playwright on Bun is new (Bun 1.4, August 2026). If it fails in CI, the browser tests run under
  Node in CI only, and nothing changes locally.
- Escape's `cancel` event not being cancelable in some cases (handled by the fallback in section 7.2).
