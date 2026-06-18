// Tiny static file server for local previews. Run `node serve.mjs` after
// `node build.mjs` and visit http://127.0.0.1:4173/.
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const PORT = Number(process.env.PORT || 4173);

createServer((req, res) => {
  try {
    let url = decodeURIComponent((req.url || "/").split("?")[0]);
    if (url.endsWith("/")) url += "index.html";
    let path = join(ROOT, url);
    try {
      statSync(path);
    } catch {
      // SPA-style fallback: try url/index.html, otherwise 404.
      path = join(ROOT, url, "index.html");
    }
    const data = readFileSync(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
}).listen(PORT, () => {
  console.log(`[docs-serve] listening on http://127.0.0.1:${PORT}/`);
});
