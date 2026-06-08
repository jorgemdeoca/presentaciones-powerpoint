import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// When deployed, api/index.js is at project root level in Vercel
// dist/client is relative to the project root
const CLIENT_DIST = join(__dirname, "..", "dist", "client");

// MIME types for static assets
const MIME_TYPES = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// Load TanStack Start SSR handler
let handlerPromise;
async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = import("../dist/server/server.js").then(
      (m) => m.default ?? m
    );
  }
  return handlerPromise;
}

export default async function vercelHandler(req, res) {
  const urlPath = req.url.split("?")[0];

  // Try to serve static files from dist/client
  // Assets are hashed so safe to cache forever
  const isAsset =
    urlPath.startsWith("/assets/") ||
    urlPath === "/favicon.svg" ||
    urlPath === "/og-image.png";

  if (isAsset) {
    const filePath = join(CLIENT_DIST, urlPath);
    if (existsSync(filePath)) {
      const ext = extname(filePath);
      const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";
      const isHashed = urlPath.startsWith("/assets/");
      
      res.setHeader("Content-Type", mimeType);
      if (isHashed) {
        // Hashed assets are immutable
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
      
      try {
        const content = readFileSync(filePath);
        res.statusCode = 200;
        res.end(content);
        return;
      } catch {
        // Fall through to SSR
      }
    }
  }

  // All other requests go to SSR handler
  const host = req.headers.host ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const url = `${proto}://${host}${req.url}`;

  // Read request body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: body && body.length > 0 ? body : undefined,
    duplex: "half",
  });

  try {
    const handler = await getHandler();
    const response = await handler.fetch(request, process.env, {});

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      // Skip transfer-encoding as Node handles it automatically
      if (key.toLowerCase() !== "transfer-encoding") {
        res.setHeader(key, value);
      }
    });

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (error) {
    console.error("SSR error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end("Internal Server Error");
  }
}
