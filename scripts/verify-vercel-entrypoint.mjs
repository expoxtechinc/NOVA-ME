import http from "node:http";
import handler from "../api/index.ts";

const server = http.createServer((req, res) => handler(req, res));
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
try {
  const response = await fetch(`http://127.0.0.1:${port}/api/trpc/aiBuilder.createPlan?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad-json",
  });
  const body = await response.text();
  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = null; }
  console.log(JSON.stringify({ status: response.status, contentType: response.headers.get("content-type"), isJson: Boolean(parsed), error: parsed?.error ?? null }));
  if (!parsed || typeof parsed.error !== "string") process.exitCode = 1;
} finally {
  await new Promise(resolve => server.close(resolve));
}
