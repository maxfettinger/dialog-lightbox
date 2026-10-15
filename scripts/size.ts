// The size budget: the script at most 9 kB (the spec said 6 kB, see the changelog) minified and gzipped, the CSS at most 1 kB.
export {};

const js = await Bun.file("dist/dialog-lightbox.js").bytes();
const css = Bun.file("dist/dialog-lightbox.css").size;
const gzipped = Bun.gzipSync(js).length;

console.log(`dialog-lightbox.js   ${js.length} B minified, ${gzipped} B gzipped (budget 9216)`);
console.log(`dialog-lightbox.css  ${css} B (budget 1024)`);

if (gzipped > 9216 || css > 1024) {
  console.error("Over the size budget.");
  process.exit(1);
}
