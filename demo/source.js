// Shows an example's own code under it: the marked parts of the page's source as the server sends it, so the
// code you read is the code that runs. Links to the local build become links to the released files on jsDelivr.
const CDN = "https://cdn.jsdelivr.net/npm/dialog-lightbox@0.2/dist/";

const source = await (await fetch(location.pathname)).text();
const between = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  return from < 0 || to < 0 ? "" : source.slice(from + start.length, to);
};

const parts = {
  html: [between("<!-- head -->", "<!-- /head -->"), between("<!-- example -->", "<!-- /example -->")],
  css: [between("<style data-example>", "</style>")],
  js: [between('<script type="module" data-example>', "</script>")],
};

/** Removes the common indentation and the blank lines around a block. */
function dedent(text) {
  const lines = text.replace(/^\s*\n|\n\s*$/g, "").split("\n");
  const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.search(/\S/)));
  return lines.map((line) => line.slice(indent)).join("\n");
}

for (const [name, blocks] of Object.entries(parts)) {
  const code = document.querySelector(`[data-source="${name}"]`);
  if (!code) continue;
  const text = blocks
    .filter((block) => block.trim())
    .map(dedent)
    .join("\n\n");
  if (text) code.textContent = text.replaceAll("../lib/", CDN);
  else code.closest("section")?.remove();
}
