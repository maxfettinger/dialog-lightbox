---
title: "The dialog"
weight: 2
lead: "One dialog serves every gallery on a page."
---

Only the viewport is required; leave out any part you don't need, and gestures and keys still work.

## Markup

```html {file="index.html"}
<dialog aria-label="Photo viewer">
  <div data-dlb-viewport></div>
  <p><span data-dlb-counter></span> / <span data-dlb-total></span></p>
  <button type="button" data-dlb-zoom aria-label="Zoom">…</button>
  <button type="button" data-dlb-close aria-label="Close">…</button>
  <button type="button" data-dlb-prev aria-label="Previous">…</button>
  <button type="button" data-dlb-next aria-label="Next">…</button>
  <template data-dlb-overlay="video">
    <button type="button" data-dlb-play aria-label="Play">…</button>
    <button type="button" data-dlb-mute aria-label="Sound off">…</button>
    <button type="button" data-dlb-fullscreen aria-label="Fullscreen">…</button>
    <span data-dlb-progress></span>
  </template>
</dialog>
```

## Parts

| Element | |
|---|---|
| `[data-dlb-viewport]` | The slides go here and gestures start here. Its padding is the room the photo leaves free for your buttons and caption |
| `[data-dlb-close]`, `[data-dlb-prev]`, `[data-dlb-next]`, `[data-dlb-zoom]` | Buttons; disabled where they can't act |
| `[data-dlb-counter]`, `[data-dlb-total]` | The counter gets the slide's number, "3", and the total gets the number of slides, "16" |
| `[data-dlb-play]`, `[data-dlb-mute]` | Video buttons. `aria-pressed` is true while playing or muted, so label them "Play" and "Sound off" |
| `[data-dlb-fullscreen]` | Opens the video in the browser's own fullscreen player, which is Apple's player on iPhone. Disabled on photos |
| `[data-dlb-progress]` | Gets `--dlb-progress` from 0 to 1 while a video plays |
| `<template data-dlb-overlay>` | Copied over each slide's photo or video as `<div data-dlb-overlay>`, so what's inside moves, swipes and shrinks with the media. `="video"` or `="image"` limits it to one type |

Buttons and progress bars work in the dialog and inside an overlay alike.
