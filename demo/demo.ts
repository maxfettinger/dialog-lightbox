import { lightbox } from "../src/index";

const dialog = document.querySelector("dialog")!;
const caption = dialog.querySelector<HTMLElement>(".caption")!;

for (const gallery of document.querySelectorAll<HTMLElement>(".frames")) {
  const box = lightbox({ gallery, dialog });
  box.on("change", ({ link }) => {
    caption.textContent = link.closest("figure")?.querySelector("figcaption")?.textContent?.trim() ?? "";
  });
}
