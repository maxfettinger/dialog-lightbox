---
title: Examples
weight: 20
lead: One feature per example, each running live with only the code it needs.
---

Every example on these pages runs on the page, and below it are exactly the files that run: `example.html`, and where
needed `style.css` and `script.js`. The scripts import `dialog-lightbox` as you would after `npm install`.

## The dialog

All examples share one dialog. Only the viewport is required; the library finds the other parts by their attributes
and disables buttons that can't act.

{{< example name="dialog" run="false" title="The shared dialog" >}}
