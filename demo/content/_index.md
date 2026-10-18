---
title: dialog-lightbox
lead: A lightbox on the native <dialog>. Swipe, zoom and video for the photos you link to. It adds the behaviour; your markup and CSS decide how it looks.
try:
  - { src: media/boat-1600.webp, thumb: media/boat-480.webp, width: 1600, height: 1067, alt: A small boat on still water in front of autumn mountains }
  - { src: media/northcape-1600.webp, thumb: media/northcape-480.webp, width: 1084, height: 1600, alt: The globe monument on the cliff of the North Cape above the sea }
  - { src: media/waves.mp4, thumb: media/waves-480.webp, width: 960, height: 540, video: true, alt: Waves breaking on a rocky shore }
  - { src: media/aurora-3200.webp, thumb: media/aurora-720.webp, width: 3200, height: 880, alt: Northern lights over a fjord and snowy mountains at night }
  - { src: media/bodo-1600.webp, thumb: media/bodo-480.webp, width: 1600, height: 1053, alt: A blue fishing boat on calm water near Bodø }
  - { src: media/ice-1600.webp, thumb: media/ice-480.webp, width: 1047, height: 1600, alt: A small ice floe in fog under a pale sun on a dark sea }
---

## What it does

- Opens with a zoom out of the thumbnail, also when CSS crops it, and closes back into it.
- Swipe or drag between slides, drag down to close, click or double-tap to zoom, drag to pan.
- Plays short videos muted and inline, with your own play, sound and fullscreen buttons.
- The back button closes it, and a `#dlb=<id>` link opens a slide.
- It's a real modal dialog: focus stays inside, Escape closes it, the page behind is inert.
- No look of its own. You write the buttons and the CSS; the library reports its state as attributes.

## Quick start

Each thumbnail links to its large file, so the page works without JavaScript. One dialog with a viewport serves every gallery on the page.

```html {file="index.html"}
<div class="gallery">
  <a href="ferry-1600.webp"><img src="ferry-480.webp" alt="The ferry at Kiel" /></a>
  <a href="ride.mp4" data-dlb-type="video"><img src="ride-poster.webp" alt="Riding to the ferry" /></a>
</div>

<dialog aria-label="Photo viewer">
  <div data-dlb-viewport></div>
  <button type="button" data-dlb-close>Close</button>
</dialog>
```

```js {file="script.js"}
import { lightbox } from "dialog-lightbox";
import "dialog-lightbox/dialog-lightbox.css";

lightbox({ gallery: document.querySelector(".gallery"), dialog: document.querySelector("dialog") });
```

Without npm or a build step, load both files from jsDelivr:

```html {file="index.html"}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/dialog-lightbox.css" />
<script type="module">
  import { lightbox } from "https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/dialog-lightbox.js";

  lightbox({ gallery: document.querySelector(".gallery"), dialog: document.querySelector("dialog") });
</script>
```

## Next

The [examples](examples/) show one feature each, live and with their code: cropped thumbnails, zoom, captions, video, deep links and the API. The [docs](docs/) list every attribute, option and state on one page.
