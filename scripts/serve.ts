// Dev server for the browser tests (and later the demo). Bun bundles each HTML page with its TypeScript and
// CSS; every other file comes from the repository, with byte ranges, which Safari needs to play video.
import fixture from "../test/browser/fixture.html";

const flag = process.argv.indexOf("--port");
const port = flag > 0 ? Number(process.argv[flag + 1]) : 3000;
const root = `${import.meta.dir}/..`;

const server = Bun.serve({
  hostname: "0.0.0.0",
  port,
  development: { hmr: false },
  routes: { "/test/browser/": fixture },
  async fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    const file = Bun.file(`${root}${path}`);
    if (path.includes("..") || !(await file.exists())) return new Response("Not found", { status: 404 });
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

console.log(`Test fixture: http://localhost:${server.port}/test/browser/`);
