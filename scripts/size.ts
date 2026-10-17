// The size budget: the script at most 10 kB minified and gzipped (raised for 0.2.0, see the changelog), the CSS at most 1 kB.
export {};

const js = await Bun.file("dist/dialog-lightbox.js").bytes();
const css = Bun.file("dist/dialog-lightbox.css").size;
const gzipped = Bun.gzipSync(js).length;

console.log(`dialog-lightbox.js   ${js.length} B minified, ${gzipped} B gzipped (budget 10240)`);
console.log(`dialog-lightbox.css  ${css} B (budget 1024)`);

if (gzipped > 10240 || css > 1024) {
  console.error("Over the size budget.");
  process.exit(1);
}
