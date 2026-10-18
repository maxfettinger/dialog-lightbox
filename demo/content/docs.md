---
title: Docs
lead: Everything the library reads and writes, on one page.
toc: true
---

The library finds the parts of your page by their `data-dlb-*` attributes, adds the behaviour, and reports its state as attributes your CSS can use. It ships no look of its own: `dialog-lightbox.css` only does layout, in the cascade layer `dialog-lightbox`, so your styles win without fighting specificity.

## Links

Every `<a href>` inside the gallery is a slide, in order. Its first `<img>` is the thumbnail, which has to show the whole photo. Crop it with `object-fit: cover` if you want frames; the box then opens by zooming out of the frame.

```html {file="index.html"}
<a href="ferry-1600.webp" data-dlb-width="1600" data-dlb-height="1067"
   data-dlb-srcset="ferry-1080.webp 1080w, ferry-1600.webp 1600w">
  <img src="ferry-480.webp" alt="The ferry at Kiel" />
</a>
```

| Attribute | |
|---|---|
| `href` | The large image or the video file |
| `data-dlb-type="video"` | A video; the thumbnail is its poster and should be its first frame |
| `data-dlb-srcset` | `srcset` for the large image; its largest `w` is taken as the native width |
| `data-dlb-width`, `data-dlb-height` | Native size, if you have it, so the box can open and zoom at once. Without them the thumbnail's aspect ratio is used |
| `data-dlb-id` | A stable id for `#dlb=` links. Without it the id is `<gallery id>-<number>` |
| `data-dlb-noaudio` | The video has no sound; the mute button is disabled |

## The dialog

One `<dialog>` serves every gallery on a page. Only the viewport is required; leave out any part you don't need, and gestures and keys still work.

```html {file="index.html"}
<dialog aria-label="Photo viewer">
  <div data-dlb-viewport></div>
  <p><span data-dlb-counter></span> / <span data-dlb-total></span></p>
  <button type="button" data-dlb-zoom aria-label="Zoom">…</button>
  <button type="button" data-dlb-close aria-label="Close">…</button>
  <button type="button" data-dlb-prev aria-label="Previous">…</button>
  <button type="button" data-dlb-next aria-label="Next">…</button>
  <template data-dlb-overlay="video">
    <button type="button" data-dlb-play aria-label="Play">…</button>
    <button type="button" data-dlb-mute aria-label="Sound off">…</button>
    <button type="button" data-dlb-fullscreen aria-label="Fullscreen">…</button>
    <span data-dlb-progress></span>
  </template>
</dialog>
```

| Element | |
|---|---|
| `[data-dlb-viewport]` | The slides go here and gestures start here. Its padding is the room the photo leaves free for your buttons and caption |
| `[data-dlb-close]`, `[data-dlb-prev]`, `[data-dlb-next]`, `[data-dlb-zoom]` | Buttons; disabled where they can't act |
| `[data-dlb-counter]`, `[data-dlb-total]` | The counter gets the slide's number, "3", and the total gets the number of slides, "16" |
| `[data-dlb-play]`, `[data-dlb-mute]` | Video buttons. `aria-pressed` is true while playing or muted, so label them "Play" and "Sound off" |
| `[data-dlb-fullscreen]` | Opens the video in the browser's own fullscreen player, which is Apple's player on iPhone. Disabled on photos |
| `[data-dlb-progress]` | Gets `--dlb-progress` from 0 to 1 while a video plays |
| `<template data-dlb-overlay>` | Copied over each slide's photo or video as `<div data-dlb-overlay>`, so what's inside moves, swipes and shrinks with the media. `="video"` or `="image"` limits it to one type |

Buttons and progress bars work in the dialog and inside an overlay alike.

## JavaScript

```js {file="script.js"}
import { lightbox } from "dialog-lightbox";

const box = lightbox({ gallery, dialog, loop: false, history: true });
box.on("change", (slide) => {
  caption.textContent = slide.link.querySelector("img")?.alt ?? "";
});
```

| Option | Default | |
|---|---|---|
| `gallery` | | Element whose links are the slides |
| `dialog` | | Your `<dialog>` |
| `loop` | `false` | After the last slide comes the first |
| `history` | `true` | The back button closes the box, and `#dlb=<id>` opens a slide |

| `lightbox()` returns | |
|---|---|
| `open(index = 0)`, `close()` | Open on a slide, or close |
| `next()`, `prev()`, `goTo(index)` | Move while open |
| `current`, `count` | The current slide (`null` while closed) and the number of slides |
| `video` | The one `<video>` element |
| `on(event, handler)` | `"open"`, `"change"` or `"close"`; returns a function that removes the handler. `change` also fires right after `open` |
| `destroy()` | Closes without animation and removes every listener. The last lightbox of a dialog also removes the attributes and text it wrote there |

A slide is `{ index, id, type, link }`, where `link` is the thumbnail's `<a>`.

## State for your CSS

On the dialog:

| Attribute | Set when |
|---|---|
| `data-dlb-type` | `image` or `video`, for the current slide |
| `data-dlb-first`, `data-dlb-last` | At either end |
| `data-dlb-loading`, `data-dlb-error` | The large file is loading or failed |
| `data-dlb-zoomable`, `data-dlb-zoomed` | The photo can zoom, or is zoomed |
| `data-dlb-ui-hidden` | After a tap on a photo, to hide your buttons |
| `data-dlb-paused`, `data-dlb-muted`, `data-dlb-noaudio` | The video's state |
| `data-dlb-animating` | During the opening and closing zoom and the drag down |
| `data-dlb-moving` | While anything moves |

| Custom property | |
|---|---|
| `--dlb-opacity` | From 0 to 1 while the box opens, and back while it closes, for the backdrop |
| `--dlb-progress` | On progress bars, from 0 to 1 |
| `--dlb-media-x`, `-y`, `-width`, `-height` | The rectangle where the current photo or video rests |

The current slide has `data-dlb-current`, and the others are `inert`.

```css {file="style.css"}
dialog[data-dlb]::backdrop {
  background: rgb(0 0 0 / var(--dlb-opacity));
}

dialog:not([data-dlb-type="video"]) .video-bar {
  display: none;
}
```

## Gestures and keys

| | Mouse | Touch | Keys |
|---|---|---|---|
| Next or previous | Drag sideways | Swipe | ← → |
| Zoom | Click the photo | Double-tap | |
| Pan a zoomed photo | Drag | Drag | |
| Close | Click beside the photo | Drag down, or tap beside it | Escape |
| Hide the buttons | | Tap the photo | |
| Play or pause | Click the video | Tap it | Space |
| Sound on or off | | | M |

## Good to know

- A CSS reset doesn't need undoing: the slide's media get `max-width: none` inline.
- The current slide holds two images, the thumbnail and the large one on top. `[data-dlb-current] img:last-of-type` is the large one.
- Overlay copies are `div[data-dlb-overlay]`; the template has the attribute too.
- Browsers: Safari 17.4, Chrome and Edge 122, Firefox 132 and later (Baseline 2024).

The [examples](../examples/) show these parts at work. The [README](https://github.com/maxfettinger/dialog-lightbox#readme) has the same reference, plus a comparison with other lightboxes.
