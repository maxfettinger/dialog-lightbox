# Changelog

## Unreleased

`data-dlb-srcset` is gone. The box always loads the file in `href`, and the native width for zooming comes from `data-dlb-width` or from that file once it has loaded.

`[data-dlb-counter]` now gets only the current slide's number, "3", and a new `[data-dlb-total]` gets the number of slides, "16". A page that showed "3 / 16" in one element puts the slash between the two itself.

The thumbnail stays visible while the box opens and closes. After closing by touch or mouse it gets focus back without a focus ring; after a key it keeps the ring.

The opening and closing zoom run on springs close to the ones of Lightbox3, and the visible frame grows in a straight line from the thumbnail's box to the photo, so a cropped thumbnail opens up evenly instead of late. The zoom button, the fades and the backdrop use the same springs: zooming in and opening at one speed, zooming out and closing a little faster.

A looping gallery of two slides shows the other slide on both sides, so a swipe to the right no longer shows empty space.

`next()`, `prev()` and `goTo()` called while the box zooms open, for example right after `open()`, now wait for the zoom to end instead of being dropped.

When the last lightbox of a dialog is destroyed, `destroy()` also removes what the lightboxes wrote into the dialog: `data-dlb`, the viewport's `tabindex`, `--dlb-opacity`, the counter's text, and `disabled` and `aria-pressed` on the buttons.

## 0.2.0 (2026-10-18)

The page's own controls can now sit on the photo or video. A `<template data-dlb-overlay>` in the dialog is copied over the media of each slide and moves, swipes and shrinks with it, and `data-dlb-overlay="video"` or `"image"` limits it to one slide type. A `[data-dlb-fullscreen]` button hands the current video to the browser's own fullscreen player, which on iPhone is Apple's player.

A `#dlb=<id>` link now also works on a page that is already open: it opens that slide, or moves to it when the box is open, and a hash without `#dlb=` closes the box. The dialog has `data-dlb-animating` during the opening and closing zoom and the drag down, `data-dlb-moving` while anything moves, and the resting rectangle of the media in `--dlb-media-x`, `-y`, `-width` and `-height`.

Buttons work wherever they are in the dialog, slides that aren't current are inert, a CSS reset that caps every element's width no longer stops the zoom, and the CSS is minified. A link to the package on jsDelivr without a file path gives the script, and each GitHub release has the built files attached.

The script is about 9.5 kB gzipped, and the size check allows 10 kB.

## 0.1.0 (2026-10-15)

The first version: a lightbox on the native `<dialog>` that opens with a zoom out of the thumbnail, swipes between slides, closes when dragged down, zooms by click or double tap and pans, plays muted inline videos with play, sound and progress, and closes with the back button. `#dlb=<id>` links open a slide.

The script is about 8.7 kB gzipped, above the 6 kB the design aimed for; the size check allows 9 kB for now.
