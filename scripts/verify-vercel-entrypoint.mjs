import http from "node:http";
import handler from "../api/index.source.ts";

function adaptResponse(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.type = contentType => { res.setHeader("content-type", contentType); return res; };
  res.json = body => { res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); };
  return res;
}

const server = http.createServer((req, res) => handler(req, adaptResponse(res)));
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
try {
  const health = await fetch(`http://127.0.0.1:${port}/api/healthz`);
  const healthBody = await health.json();
  if (health.status !== 200 || healthBody.success !== true) throw new Error("Vercel health endpoint failed");
  const response = await fetch(`http://127.0.0.1:${port}/api/trpc/aiBuilder.createPlan?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad-json",
  });
  const body = await response.text();
  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = null; }
  console.log(JSON.stringify({ health: healthBody, status: response.status, contentType: response.headers.get("content-type"), isJson: Boolean(parsed), error: parsed?.error ?? null }));
  if (!parsed || typeof parsed.error !== "string") process.exitCode = 1;
} finally {
  await new Promise(resolve => server.close(resolve));
}
