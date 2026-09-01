// Minimal zero-dependency static file server for local manual verification
// only (design.md: vanilla ES modules, no build step -- no bundler was
// introduced just to run this locally).
//
// Mirrors the production doc-root layout (design.md's target file tree:
// public/ IS the deployed web root, with index.html referencing "/src/..."
// and "/config.js" as if src/ and config.js sit right next to it) without
// an actual file-copy step: requests under /src/ are served from the
// repo's src/ directory, everything else from public/ -- so index.html's
// absolute paths resolve exactly as they will once deployed.
//
// Usage: npm run dev, then open http://localhost:5173/
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const REPO_ROOT = process.cwd();
const PUBLIC_ROOT = join(REPO_ROOT, "public");
const PORT = Number(process.env.PORT) || 5173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    // Decide the root from the original forward-slash URL path -- normalize()
    // rewrites separators to the OS style (backslashes on Windows), which
    // would break a "/src/" prefix check done after normalizing.
    const base = urlPath === "/src" || urlPath.startsWith("/src/") ? REPO_ROOT : PUBLIC_ROOT;
    // Strip any ".." segments before joining so a request can't escape its root.
    const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    let filePath = join(base, safePath);

    const info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) filePath = join(filePath, "index.html");

    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Dev server running: http://localhost:${PORT}/`);
});
