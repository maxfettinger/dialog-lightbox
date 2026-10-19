---
title: "Styling"
weight: 4
lead: "The library reports its state as attributes and custom properties."
---

## On the dialog

| Attribute | Set when |
|---|---|
| `data-dlb-type` | `image` or `video`, for the current slide |
| `data-dlb-first`, `data-dlb-last` | At either end |
| `data-dlb-loading`, `data-dlb-error` | The large file is loading or failed |
| `data-dlb-zoomable`, `data-dlb-zoomed` | The photo can zoom, or is zoomed |
| `data-dlb-ui-hidden` | After a tap on a photo, to hide your buttons |
| `data-dlb-paused`, `data-dlb-muted`, `data-dlb-noaudio` | The video's state |
| `data-dlb-animating` | During the opening and closing zoom and the drag down |
| `data-dlb-moving` | While anything moves |

## Custom properties

| Custom property | |
|---|---|
| `--dlb-opacity` | From 0 to 1 while the box opens, and back while it closes, for the backdrop |
| `--dlb-progress` | On progress bars, from 0 to 1 |
| `--dlb-media-x`, `-y`, `-width`, `-height` | The rectangle where the current photo or video rests |

The current slide has `data-dlb-current`, and the others are `inert`.

## Example

```css {file="style.css"}
dialog[data-dlb]::backdrop {
  background: rgb(0 0 0 / var(--dlb-opacity));
}

dialog:not([data-dlb-type="video"]) .video-bar {
  display: none;
}
```
