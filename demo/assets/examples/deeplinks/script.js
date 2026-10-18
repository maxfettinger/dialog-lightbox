import { lightbox } from "/lib/dialog-lightbox.js";

// history is on by default: opening adds #dlb=<id> to the URL, and the back button closes the box
lightbox({ gallery: document.querySelector("#norway"), dialog: document.querySelector("dialog.box") });
