# dialog-lightbox

A lightweight lightbox on the native `<dialog>`: swipe, zoom, video. It adds behavior; the markup and CSS stay yours.

Try it on the [demo site](https://dialog-lightbox.maxfettinger.com), ideally on a phone. It has an example for each feature, live with its code, and short docs.

The script is about 9.5 kB gzipped and has no dependencies. You write the dialog, its buttons and every style yourself. The library finds the parts by their `data-dlb-*` attributes, adds the behavior, and reports its state as attributes your CSS can use.

What it does:

- opens with a zoom out of the thumbnail, also when the thumbnail is cropped with `object-fit: cover`
- swipe between photos, drag down to close, click or double-tap to zoom, drag to pan
- plays short videos muted and inline, without native controls, so they never get in the way of swiping
- the back button closes the box, and a `#dlb=<id>` link opens a photo directly
- arrow keys and Escape; Space and M on videos

## Compared with other lightboxes

Sizes are the files in each npm package compressed with gzip, measured on 15 October 2026 (ours on 18 October, for 0.2.0). Their CSS includes a theme; ours only does layout.

| | Script + CSS | Native `<dialog>` | Video | Back button | License |
|---|---|---|---|---|---|
| dialog-lightbox | 9.5 + 0.4 kB | yes | video files | yes | MIT |
| [PhotoSwipe 5](https://photoswipe.com) | 20.9 + 2.4 kB | no | plugin | no | MIT |
| [GLightbox](https://github.com/biati-digital/glightbox) | 15.3 + 2.6 kB | no | YouTube, Vimeo, files | no | MIT |
| [lightGallery](https://www.lightgalleryjs.com) | 18.9 + 2.8 kB, plugins extra | no | plugin | plugin | GPLv3 or paid |
| [Fancybox 6](https://fancyapps.com/fancybox/) | 36.8 + 6.4 kB | yes | YouTube, Vimeo, files | plugin | paid |
| [basicLightbox](https://github.com/electerious/basicLightbox) | 1.3 + 0.4 kB | no | any HTML | no | MIT |

All of them have no dependencies and TypeScript types, except basicLightbox (no types). dialog-lightbox does not have pinch zoom, YouTube or Vimeo, a thumbnail strip, fullscreen or plugins. If you need one of those, use one of the libraries above.

## Install

```sh
npm install dialog-lightbox
```

`bun add` and `pnpm add` work the same way.

### Without npm

A plain HTML page can load both files from the jsDelivr CDN, with no build step:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/dialog-lightbox.css" />
<script type="module">
  import { lightbox } from "https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/dialog-lightbox.js";

  lightbox({ gallery: document.querySelector(".gallery"), dialog: document.querySelector("dialog") });
</script>
```

`@0.2` gets the newest 0.2.x release. To host the files yourself, download [dialog-lightbox.js](https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/dialog-lightbox.js) and [dialog-lightbox.css](https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/dialog-lightbox.css) and put them next to your page.

## Markup

Each thumbnail links to its large file, so the page works without JavaScript too:

```html
<div class="gallery">
  <a href="ferry-1600.webp" data-dlb-width="1600" data-dlb-height="1067">
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
  <p><span data-dlb-counter></span> / <span data-dlb-total></span></p>
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
| `destroy()` | Closes without animation and removes every listener. The last lightbox of a dialog also removes the attributes and text it wrote there |

A slide is `{ index, id, type, link }`, where `type` is `"image"` or `"video"` and `link` is the thumbnail's `<a>`. `change` also fires once right after `open`, which makes it the place for captions.

## Attributes

On the links:

| Attribute | |
|---|---|
| `href` | The large image or the video file |
| `data-dlb-type="video"` | A video; the thumbnail is its poster |
| `data-dlb-width`, `data-dlb-height` | Native size, if you have it. Without them the thumbnail's aspect ratio is used |
| `data-dlb-id` | A stable id for `#dlb=` links. Without it the id is `<gallery id>-<number>` |
| `data-dlb-noaudio` | The video has no sound; the mute button is disabled |

Inside the dialog:

| Element | |
|---|---|
| `[data-dlb-viewport]` | Required. The slides go here, gestures start here, and its padding is the room the photo leaves free |
| `[data-dlb-close]`, `[data-dlb-prev]`, `[data-dlb-next]`, `[data-dlb-zoom]` | Buttons; disabled where they can't act |
| `[data-dlb-counter]`, `[data-dlb-total]` | The counter gets the slide's number, "3", and the total gets the number of slides, "16" |
| `[data-dlb-play]`, `[data-dlb-mute]` | Video buttons; `aria-pressed` is true while playing or muted, so label them "Play" and "Sound off" |
| `[data-dlb-fullscreen]` | Opens the video in the browser's own fullscreen player, with native controls; on iPhone that is Apple's player. Time, pause and sound carry over both ways. Disabled on photos |
| `[data-dlb-progress]` | Gets `--dlb-progress` from 0 to 1 while a video plays |
| `<template data-dlb-overlay>` | Copied over the media of each slide as `<div data-dlb-overlay>` (select the copies with `div[data-dlb-overlay]`, since the template has the attribute too), which covers exactly the photo or video and moves, swipes and shrinks with it. `data-dlb-overlay="video"` or `"image"` limits it to one slide type, and you can have one template of each. The buttons and progress bars above work inside it too |

State on the dialog, for your CSS: `data-dlb-type` (`image` or `video`), `data-dlb-first`, `data-dlb-last`, `data-dlb-loading`, `data-dlb-error`, `data-dlb-zoomable`, `data-dlb-zoomed`, `data-dlb-ui-hidden` (after a tap on a photo), `data-dlb-paused`, `data-dlb-muted`, `data-dlb-noaudio`, and `data-dlb-animating` while the media zoom from or to the thumbnail or are dragged down. The current slide has `data-dlb-current`, so overlay copies in the neighbouring slides can look different, and the slides that aren't current are `inert`. The library's CSS fades an overlay out while the dialog is animating or zoomed. `data-dlb-moving` is set while anything moves (opening, closing, a swipe, a zoom, a drag). `--dlb-media-x`, `--dlb-media-y`, `--dlb-media-width` and `--dlb-media-height` on the dialog give the rectangle where the current photo or video rests, in pixels from the viewport's corner. They are written as soon as that place is known, so during an animation they already hold the end values; wait for `data-dlb-moving` to go away if you need the media to be there. `--dlb-opacity` goes from 0 to 1 while the box opens, and back while it closes or is dragged down.

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

### Good to know

- A CSS reset doesn't need undoing. Slide images, videos and their wrapper get `max-width: none` inline, so rules like `img { max-inline-size: 100% }` or `* { max-width: 100% }` don't stop the zoom.
- The current slide holds two images: the thumbnail as a placeholder and, once it has loaded, the large image on top. In tests or CSS, `[data-dlb-current] img:last-of-type` is the large one.
- A video always starts from its first frame, and until it plays the slide shows the thumbnail. Make the first frame the thumbnail, or the picture jumps when playback starts.

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
