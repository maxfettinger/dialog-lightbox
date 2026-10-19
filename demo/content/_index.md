---
title: dialog-lightbox
lead: A lightbox on the native `<dialog>`. Swipe, zoom and video for the photos you link to. It adds the behaviour; your markup and CSS decide how it looks.
facts: ["9.6 kB gzip", "0 dependencies", "TypeScript", "MIT", "Baseline 2024"]
install: npm install dialog-lightbox
actions:
  - { label: Get started, url: docs/getting-started/ }
  - { label: Examples, url: examples/ }
---

## Try it

Click or tap a photo. Swipe or use the arrow keys, zoom with a click or double tap, close with a drag down, Escape or
the back button.

{{< example name="try" code="false" >}}

{{< example name="dialog" frame="false" >}}

## What it does

- Opens with a zoom out of the thumbnail, also when CSS crops it, and closes back into it.
- Swipe or drag between slides, drag down to close, click or double-tap to zoom, drag to pan.
- Plays short videos muted and inline, with your own play, sound and fullscreen buttons.
- The back button closes it, and a `#dlb=<id>` link opens a slide.
- It's a real modal dialog: focus stays inside, Escape closes it, the page behind is inert.
- No look of its own. You write the buttons and the CSS; the library reports its state as attributes.

The [examples](examples/) show one feature each, running live next to their code. The [docs](docs/) list every
attribute, option and state.
