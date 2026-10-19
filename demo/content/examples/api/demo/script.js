import { lightbox } from "dialog-lightbox";

const log = document.querySelector(".log");
const box = lightbox({
  gallery: document.querySelector("#controlled"),
  dialog: document.querySelector("dialog.box"),
  loop: true,
});

document.querySelector(".open-last").addEventListener("click", () => box.open(box.count - 1));

for (const type of ["open", "change", "close"]) {
  box.on(type, (slide) => {
    log.textContent += `${type.padEnd(6)} slide ${slide.index + 1} of ${box.count} (#dlb=${slide.id})\n`;
    log.scrollTop = log.scrollHeight;
  });
}
