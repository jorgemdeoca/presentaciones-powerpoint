import { createServer } from "node:http";
import handler from "../dist/server/server.js";

// Vercel serverless adapter for TanStack Start
// Wraps the Web-standard fetch handler into a Node.js req/res handler

export default async function vercelHandler(req, res) {
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

  const response = await handler.fetch(request, process.env, {});

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
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
}
