import { lightbox } from "/lib/dialog-lightbox.js";

const dialog = document.querySelector(".box");
const caption = dialog.querySelector(".box-caption");
const box = lightbox({ gallery: document.querySelector(".gallery"), dialog });

// The thumbnail's alt text as the caption
box.on("change", ({ link }) => {
  caption.textContent = link.querySelector("img")?.alt ?? "";
});
