---
title: "Good to know"
weight: 2
lead: "Small things worth knowing."
---

## Notes

- A CSS reset doesn't need undoing: the slide's media get `max-width: none` inline.
- The current slide holds two images, the thumbnail and the large one on top. `[data-dlb-current] img:last-of-type` is the large one.
- iOS draws a grey box where a tap lands, on the thumbnails and in the box. `html { -webkit-tap-highlight-color: transparent; }` in your CSS turns it off, as on this demo.
- Overlay copies are `div[data-dlb-overlay]`; the template has the attribute too.
- Browsers: Safari 17.4, Chrome and Edge 122, Firefox 132 and later (Baseline 2024).

The [examples](../../../examples/) show these parts at work. The [README](https://github.com/maxfettinger/dialog-lightbox#readme) has the same reference, plus a comparison with other lightboxes.
