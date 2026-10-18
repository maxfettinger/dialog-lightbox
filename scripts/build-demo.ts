// Builds the demo site into site/: the files in demo/ as they are, plus the built library in site/lib/, which
// the pages load. Run after `bun run build`.
import { cp, mkdir, rm } from "node:fs/promises";

await rm("site", { recursive: true, force: true });
await cp("demo", "site", { recursive: true });
await mkdir("site/lib");
for (const name of ["dialog-lightbox.js", "dialog-lightbox.css"])
  await cp(`dist/${name}`, `site/lib/${name}`);
console.log("Demo site in site/");
