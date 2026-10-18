---
title: dialog-lightbox
lead: Swipe, zoom and video for the photos you link to, in about 9.5 kB with no dependencies. It adds the behaviour; your markup and CSS decide how it looks.
try:
  - { src: media/boat-1600.webp, thumb: media/boat-480.webp, width: 1600, height: 1067, alt: A small boat on still water in front of autumn mountains }
  - { src: media/northcape-1600.webp, thumb: media/northcape-480.webp, width: 1084, height: 1600, alt: The globe monument on the cliff of the North Cape above the sea }
  - { src: media/waves.mp4, thumb: media/waves-480.webp, width: 960, height: 540, video: true, alt: Waves breaking on a rocky shore }
  - { src: media/aurora-3200.webp, thumb: media/aurora-720.webp, width: 3200, height: 880, alt: Northern lights over a fjord and snowy mountains at night }
---

## What it does

- Opens with a zoom out of the thumbnail, also when CSS crops it.
- Swipe between photos, drag down to close, click or double-tap to zoom, drag to pan.
- Plays short videos muted and inline, with your own play, sound and fullscreen buttons.
- The back button closes it, and a `#dlb=<id>` link opens a photo.
- A real modal dialog: focus stays inside, Escape closes it, and the page behind is inert.

## Install {#install}

```sh
npm install dialog-lightbox
```

Or without npm, straight from a CDN in a plain HTML page:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/dialog-lightbox.css" />
<script type="module">
  import { lightbox } from "https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/dialog-lightbox.js";

  lightbox({ gallery: document.querySelector(".gallery"), dialog: document.querySelector("dialog") });
</script>
```

## Quick start

Each thumbnail links to its large file, so the page works without JavaScript too. One dialog with a viewport serves every gallery on the page:

```html
<div class="gallery">
  <a href="ferry-1600.webp"><img src="ferry-480.webp" alt="The ferry at Kiel" /></a>
  <a href="ride.mp4" data-dlb-type="video"><img src="ride-poster.webp" alt="Riding to the ferry" /></a>
</div>

<dialog aria-label="Photo viewer">
  <div data-dlb-viewport></div>
  <button type="button" data-dlb-close aria-label="Close">×</button>
</dialog>
```

```js
import { lightbox } from "dialog-lightbox";
import "dialog-lightbox/dialog-lightbox.css";

lightbox({ gallery: document.querySelector(".gallery"), dialog: document.querySelector("dialog") });
```

Then add the buttons and styles you want. The [docs](docs/) list every attribute, option and state.
