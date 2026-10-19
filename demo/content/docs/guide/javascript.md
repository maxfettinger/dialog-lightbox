---
title: "JavaScript"
weight: 3
lead: "One function starts a lightbox and returns its controls."
---

## Usage

```js {file="script.js"}
import { lightbox } from "dialog-lightbox";

const box = lightbox({ gallery, dialog, loop: false, history: true });
box.on("change", (slide) => {
  caption.textContent = slide.link.querySelector("img")?.alt ?? "";
});
```

## Options

| Option | Default | |
|---|---|---|
| `gallery` | | Element whose links are the slides |
| `dialog` | | Your `<dialog>` |
| `loop` | `false` | After the last slide comes the first |
| `history` | `true` | The back button closes the box, and `#dlb=<id>` opens a slide |

## What it returns

| `lightbox()` returns | |
|---|---|
| `open(index = 0)`, `close()` | Open on a slide, or close |
| `next()`, `prev()`, `goTo(index)` | Move while open |
| `current`, `count` | The current slide (`null` while closed) and the number of slides |
| `video` | The one `<video>` element |
| `on(event, handler)` | `"open"`, `"change"` or `"close"`; returns a function that removes the handler. `change` also fires right after `open` |
| `destroy()` | Closes without animation and removes every listener. The last lightbox of a dialog also removes the attributes and text it wrote there |

A slide is `{ index, id, type, link }`, where `link` is the thumbnail's `<a>`.
