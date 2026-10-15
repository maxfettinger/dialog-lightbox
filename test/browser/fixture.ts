import { type Lightbox, lightbox } from "../../src/index";

// Playwright's Chromium can't play H.264, so it gets the WebM copies of the test clips.
if (!document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E"')) {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href$=".mp4"]')) {
    link.href = link.href.replace(/\.mp4$/, ".webm");
  }
}

const dialog = document.querySelector("dialog")!;
const log: string[] = [];
const boxes: Lightbox[] = [];
for (const id of ["one", "two", "three", "four"]) {
  const gallery = document.getElementById(id)!;
  const box = lightbox({
    gallery,
    dialog,
    loop: gallery.dataset.loop === "true",
    history: gallery.dataset.history !== "false",
  });
  for (const type of ["open", "change", "close"] as const)
    box.on(type, (slide) => log.push(`${type}:${slide.id}`));
  boxes.push(box);
}
Object.assign(window, { boxes, log, lightbox });
