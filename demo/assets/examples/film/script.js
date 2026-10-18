import { lightbox } from "/lib/dialog-lightbox.js";

const dialog = document.querySelector(".viewer");
const place = dialog.querySelector(".viewer-place");
const credit = dialog.querySelector(".viewer-credit");
const box = lightbox({ gallery: document.querySelector(".film"), dialog });

// The frame's place and the photo's credit below the photo
box.on("change", ({ link }) => {
  const caption = link.closest("figure").querySelector("figcaption");
  place.textContent = caption.querySelector("[data-place]").textContent;
  credit.textContent = caption.querySelector("[data-credit]").textContent;
});
