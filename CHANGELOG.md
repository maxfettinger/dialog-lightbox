# Changelog

## Unreleased

The dialog reports the current media's rectangle in `--dlb-media-x`, `-y`, `-width` and `-height` once it has settled, and has `data-dlb-moving` while anything moves.

A `[data-dlb-fullscreen]` button opens the current video in the browser's own fullscreen player. The size check allows 10 kB for the script now.

A `<template data-dlb-overlay>` in the dialog puts the page's own controls over each photo or video, so they move with the media. The dialog has `data-dlb-animating` during the opening and closing zoom and the drag down. Buttons work wherever they are in the dialog, slides that aren't current are inert, and the CSS is now minified.

A `#dlb=<id>` link now also works on a page that is already open: it opens that slide, or moves to it if the box is open. A hash without `#dlb=` closes the box, like the back button.

A CSS reset that caps every element's width (`* { max-width: 100% }`) no longer stops the zoom. The README explains resets, the two images in a slide and first-frame posters.

A link to the package on jsDelivr without a file path now gives the script. Each GitHub release has the built script and CSS attached.

## 0.1.0 (2026-10-15)

The first version: a lightbox on the native `<dialog>` that opens with a zoom out of the thumbnail, swipes between slides, closes when dragged down, zooms by click or double tap and pans, plays muted inline videos with play, sound and progress, and closes with the back button. `#dlb=<id>` links open a slide.

The script is about 8.7 kB gzipped, above the 6 kB the design aimed for; the size check allows 9 kB for now.
