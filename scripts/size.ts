// The size budget: the script at most 12 kB minified and gzipped, the CSS at most 1 kB.
export {};

const BUDGET = 12 * 1024;

const js = await Bun.file("dist/dialog-lightbox.js").bytes();
const css = Bun.file("dist/dialog-lightbox.css").size;
const gzipped = Bun.gzipSync(js).length;

console.log(`dialog-lightbox.js   ${js.length} B minified, ${gzipped} B gzipped (budget ${BUDGET})`);
console.log(`dialog-lightbox.css  ${css} B (budget 1024)`);

if (gzipped > BUDGET || css > 1024) {
  console.error("Over the size budget.");
  process.exit(1);
}
