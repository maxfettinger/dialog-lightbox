// Dev server for the browser tests and the demo site. Bun bundles the test fixture with its TypeScript and CSS.
// The demo is plain files, served as they are; its lib/ folder is the library built fresh from src/ on each
// request. Every file comes with byte ranges, which Safari needs to play video.
import fixture from "../test/browser/fixture.html";

const flag = process.argv.indexOf("--port");
const port = flag > 0 ? Number(process.argv[flag + 1]) : 3000;
const root = `${import.meta.dir}/..`;

/** The library as the demo's lib/ folder holds it after `bun run build:demo`. */
async function lib(name: string): Promise<Response | null> {
  if (name === "dialog-lightbox.css") return new Response(Bun.file(`${root}/src/dialog-lightbox.css`));
  if (name !== "dialog-lightbox.js") return null;
  const build = await Bun.build({ entrypoints: [`${root}/src/index.ts`], target: "browser" });
  return new Response(build.outputs[0], { headers: { "content-type": "text/javascript" } });
}

const server = Bun.serve({
  hostname: "0.0.0.0",
  port,
  development: { hmr: false },
  routes: { "/test/browser/": fixture },
  async fetch(request) {
    let path = decodeURIComponent(new URL(request.url).pathname);
    if (path.includes("..")) return new Response("Not found", { status: 404 });
    if (path.startsWith("/demo/lib/"))
      return (await lib(path.slice(10))) ?? new Response("Not found", { status: 404 });
    if (path.endsWith("/")) path += "index.html";
    const file = Bun.file(`${root}${path}`);
    if (!(await file.exists())) return new Response("Not found", { status: 404 });
    const range = /bytes=(\d+)-(\d*)/.exec(request.headers.get("range") ?? "");
    if (!range) return new Response(file, { headers: { "accept-ranges": "bytes" } });
    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : file.size - 1;
    return new Response(file.slice(start, end + 1), {
      status: 206,
      headers: {
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${file.size}`,
        "content-type": file.type,
      },
    });
  },
});

console.log(`Demo: http://localhost:${server.port}/demo/`);
console.log(`Test fixture: http://localhost:${server.port}/test/browser/`);
