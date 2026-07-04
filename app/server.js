// Marginalia · 批注 — local dev server.
// Serves the client and proxies the three reading-companion endpoints to
// DeepSeek. On Vercel these endpoints are the serverless functions in ./api/;
// this file is only for `npm start` / `npm run mock` on your own machine.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { readPage, wordSense, unpack } from "./lib/reader.js";

const PORT = process.env.PORT || 3000;
const MOCK = process.env.MARGINALIA_MOCK === "1";
const ROOT = fileURLToPath(new URL("./public/", import.meta.url));

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

// small cache so repeated word taps on the same sentence are instant + free
const wordCache = new Map();
async function cachedWord(body) {
  const key = `${body.book}|${body.word}|${body.sentence}`.toLowerCase();
  if (wordCache.has(key)) return wordCache.get(key);
  const r = await wordSense(body);
  if (!r.error) wordCache.set(key, r);
  return r;
}

const ROUTES = {
  "/api/read-page": readPage,
  "/api/word": cachedWord,
  "/api/unpack": unpack,
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && ROUTES[req.url]) {
      const body = await readBody(req);
      const result = await ROUTES[req.url](body);
      res.writeHead(result.error ? 502 : 200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }
    let path = req.url.split("?")[0];
    if (path === "/") path = "/index.html";
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (err) {
    if (err.code === "ENOENT") { res.writeHead(404); res.end("not found"); return; }
    console.error(err);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: err.message || "server error" }));
  }
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 12 * 1024 * 1024) { reject(new Error("payload too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new Error("invalid JSON body")); } });
    req.on("error", reject);
  });
}

server.listen(PORT, () => {
  console.log(`Marginalia ${MOCK ? "(mock mode) " : ""}listening on http://localhost:${PORT}`);
  if (!MOCK && !process.env.DEEPSEEK_API_KEY) {
    console.log("note: DEEPSEEK_API_KEY is not set — real requests will fail. Use `npm run mock` for a keyless demo.");
  }
});
