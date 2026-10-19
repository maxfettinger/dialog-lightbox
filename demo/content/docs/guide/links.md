---
title: "Links"
weight: 1
lead: "Every link in the gallery is a slide."
---

The slides follow the order of the `<a href>` elements. A link's first `<img>` is the thumbnail, which has to show the whole photo. Crop it with `object-fit: cover` if you want frames; the box then opens by zooming out of the frame.

## Markup

```html {file="index.html"}
<a href="ferry-1600.webp" data-dlb-width="1600" data-dlb-height="1067">
  <img src="ferry-480.webp" alt="The ferry at Kiel" />
</a>
```

## Attributes

| Attribute | |
|---|---|
| `href` | The large image or the video file |
| `data-dlb-type="video"` | A video; the thumbnail is its poster and should be its first frame |
| `data-dlb-width`, `data-dlb-height` | Native size, if you have it, so the box can open and zoom at once. Without them the thumbnail's aspect ratio is used |
| `data-dlb-id` | A stable id for `#dlb=` links. Without it the id is `<gallery id>-<number>` |
| `data-dlb-noaudio` | The video has no sound; the mute button is disabled |
