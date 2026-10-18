// The demo site (demo/, Hugo). It runs the library from demo/static/lib, which this script fills from dist/.
//   bun scripts/build-demo.ts           builds the site into site/ (after `bun run build`)
//   bun scripts/build-demo.ts --serve   Hugo's dev server on port 1314, with the library rebuilt from src/ on change
import { cp, mkdir } from "node:fs/promises";
import { $ } from "bun";

await mkdir("demo/static/lib", { recursive: true });
await cp("src/dialog-lightbox.css", "demo/static/lib/dialog-lightbox.css");

if (process.argv.includes("--serve")) {
  const lib = ["build", "./src/index.ts", "--target=browser", "--outfile=demo/static/lib/dialog-lightbox.js"];
  await $`bun ${lib}`.quiet();
  Bun.spawn(["bun", ...lib, "--watch"], { stdout: "ignore" });
  await $`hugo server --source demo --bind 0.0.0.0 --baseURL / --port 1314 --renderToMemory`;
} else {
  await cp("dist/dialog-lightbox.js", "demo/static/lib/dialog-lightbox.js");
  await cp("dist/dialog-lightbox.css", "demo/static/lib/dialog-lightbox.css");
  await $`hugo --source demo --destination ${process.cwd()}/site --minify --quiet --cleanDestinationDir`;
  console.log("Demo site in site/");
}
