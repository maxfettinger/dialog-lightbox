---
title: dialog-lightbox
lead: A lightbox on the native <dialog>. Swipe, zoom and video for the photos you link to. It adds the behaviour; your markup and CSS decide how it looks.
try:
  - { src: media/photo-7-1600.jpg, thumb: media/photo-7-480.jpg, width: 1600, height: 1066, alt: Soft bands of violet, yellow, mint and purple }
  - { src: media/photo-4-1600.jpg, thumb: media/photo-4-480.jpg, width: 1066, height: 1600, alt: Amber stripes across dark red }
  - { src: media/clip-1.mp4, thumb: media/clip-1-480.jpg, width: 720, height: 1280, video: true, alt: Turquoise and dark blue bands drifting }
  - { src: media/photo-6-3200.jpg, thumb: media/photo-6-720.jpg, width: 3200, height: 800, alt: Purple, a band of orange, and pale lilac }
  - { src: media/photo-3-1600.jpg, thumb: media/photo-3-480.jpg, width: 1600, height: 1066, alt: A thin blue line between pale blue and navy }
  - { src: media/photo-5-1600.jpg, thumb: media/photo-5-480.jpg, width: 1066, height: 1600, alt: A pale green band between mint and dark green }
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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/dialog-lightbox@0.3/dist/dialog-lightbox.css" />
<script type="module">
  import { lightbox } from "https://cdn.jsdelivr.net/npm/dialog-lightbox@0.3/dist/dialog-lightbox.js";

  lightbox({ gallery: document.querySelector(".gallery"), dialog: document.querySelector("dialog") });
</script>
```

## Next

The [examples](examples/) show one feature each, live and with their code: cropped thumbnails, zoom, captions, video, deep links and the API. The [docs](docs/) list every attribute, option and state on one page.
