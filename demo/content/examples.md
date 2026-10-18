---
title: Examples
type: examples
lead: One feature per example, each running live with only the code it needs.
examples:
  - name: cropped
    title: Cropped thumbnails
    text: >-
      Crop thumbnails with CSS, not on the server. The thumbnail keeps the whole photo and `object-fit: cover` cuts the square, so the box can open with a zoom out of the crop to the whole photo, and close back into it.
  - name: zoom
    title: Zoom and srcset
    text: >-
      A click, a double tap or the zoom button zooms a photo to its native width, at most three times the size it fits at. The native width comes from `data-dlb-width` or from the largest `w` in `data-dlb-srcset`, and the zoomed photo loads the larger file. Drag to pan.
  - name: captions
    title: Captions
    text: >-
      The library has no caption of its own. Listen for `change` and write whatever you like into an element of the dialog; here it's the figure's caption.
  - name: video
    title: Video
    text: >-
      A video plays muted and inline as soon as its slide opens, started inside the click so phones allow it. Its controls come from the `<template data-dlb-overlay="video">` in the dialog, copied over each video so they move with it. `data-dlb-noaudio` disables the mute button for the second clip, which has no sound.
  - name: deeplinks
    title: Deep links and the back button
    text: >-
      Opening a slide adds `#dlb=<id>` to the URL, so the back button closes the box instead of leaving the page, and a link to that hash opens the slide, from anywhere on the page or from another site. `data-dlb-id` gives a slide an id that stays when the order changes.
  - name: api
    title: API and events
    text: >-
      `lightbox()` returns an object to open, move and close the box from your own code, and to listen for its events. This gallery also has `loop: true`, so after the last photo comes the first.
---
