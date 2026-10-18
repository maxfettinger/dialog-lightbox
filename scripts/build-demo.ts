// The demo site (demo/, Hugo). It runs the library from demo/static/lib, which this script fills from dist/.
//   bun scripts/build-demo.ts           builds the site into site/ (after `bun run build`)
//   bun scripts/build-demo.ts --serve   Hugo's dev server on port 1314, with the library rebuilt from src/ on change
import { cp, mkdir } from "node:fs/promises";
import { $ } from "bun";

await mkdir("demo/static/lib", { recursive: true });
await cp("src/dialog-lightbox.css", "demo/static/lib/dialog-lightbox.css");

// The version and the gzipped size of the minified build, for the site's header and start page
if (!(await Bun.file("dist/dialog-lightbox.js").exists())) await $`bun run build`.quiet();
const gzip = Bun.gzipSync(await Bun.file("dist/dialog-lightbox.js").bytes()).length;
const { version } = await Bun.file("package.json").json();
await Bun.write("demo/data/lib.json", `${JSON.stringify({ version, gzip })}\n`);

if (process.argv.includes("--serve")) {
  const lib = ["build", "./src/index.ts", "--target=browser", "--outfile=demo/static/lib/dialog-lightbox.js"];
  await $`bun ${lib}`.quiet();
  Bun.spawn(["bun", ...lib, "--watch"], { stdout: "ignore" });
  await $`hugo server --source demo --bind 0.0.0.0 --baseURL / --port 1314 --renderToMemory`;
} else {
  await cp("dist/dialog-lightbox.js", "demo/static/lib/dialog-lightbox.js");
  await cp("dist/dialog-lightbox.css", "demo/static/lib/dialog-lightbox.css");
  await $`hugo --source demo --destination ${process.cwd()}/site --minify --cleanDestinationDir`;
  console.log("Demo site in site/");
}
