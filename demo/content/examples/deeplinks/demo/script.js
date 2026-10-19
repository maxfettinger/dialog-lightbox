import { lightbox } from "dialog-lightbox";

// history is on by default: opening adds #dlb=<id> to the URL, and the back button closes the box
lightbox({ gallery: document.querySelector("#linked"), dialog: document.querySelector("dialog.box") });
