---
title: Getting started
weight: 1
lead: Install the library, link your photos and add one dialog.
---

## Install

{{< tabs group="install" >}}
{{< tab "npm" >}}
```sh
npm install dialog-lightbox
```
{{< /tab >}}
{{< tab "pnpm" >}}
```sh
pnpm add dialog-lightbox
```
{{< /tab >}}
{{< tab "bun" >}}
```sh
bun add dialog-lightbox
```
{{< /tab >}}
{{< tab "CDN" >}}
```html {file="index.html"}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/dialog-lightbox@0.3/dist/dialog-lightbox.css" />
<script type="module">
  import { lightbox } from "https://cdn.jsdelivr.net/npm/dialog-lightbox@0.3/dist/dialog-lightbox.js";
</script>
```
{{< /tab >}}
{{< /tabs >}}

## Link your photos

Each thumbnail links to its large file, so the page works without JavaScript. One dialog with a viewport serves every
gallery on the page.

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

## Start it

```js {file="script.js"}
import { lightbox } from "dialog-lightbox";
import "dialog-lightbox/dialog-lightbox.css";

lightbox({ gallery: document.querySelector(".gallery"), dialog: document.querySelector("dialog") });
```

{{< callout >}}
The [examples](../../examples/) show one feature each, running live next to their code.
{{< /callout >}}
