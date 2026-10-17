# Changelog

## Unreleased

A CSS reset that caps every element's width (`* { max-width: 100% }`) no longer stops the zoom. The README explains resets, the two images in a slide and first-frame posters.

A link to the package on jsDelivr without a file path now gives the script. Each GitHub release has the built script and CSS attached.

## 0.1.0 (2026-10-15)

The first version: a lightbox on the native `<dialog>` that opens with a zoom out of the thumbnail, swipes between slides, closes when dragged down, zooms by click or double tap and pans, plays muted inline videos with play, sound and progress, and closes with the back button. `#dlb=<id>` links open a slide.

The script is about 8.7 kB gzipped, above the 6 kB the design aimed for; the size check allows 9 kB for now.
