import type { Request, Response } from "express";

type App = ReturnType<(typeof import("../server/app"))["createApp"]>;
let appPromise: Promise<App> | undefined;

async function loadApp(): Promise<App> {
  const { createApp } = await import("../server/app");
  return createApp();
}

function safeErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "unknown runtime failure";
  console.error(`[NIU API bootstrap] ${raw.slice(0, 240)}`);
  if (/not configured|missing.*(key|env)|environment/i.test(raw)) return "NIU server configuration is incomplete.";
  return "NIU server request failed.";
}

export default async function handler(req: Request, res: Response) {
  const reply = res as unknown as {
    headersSent?: boolean;
    status: (code: number) => { type: (contentType: string) => { json: (body: unknown) => void } };
  };
  if (req.url?.split("?")[0] === "/api/healthz") {
    return reply.status(200).type("application/json").json({ success: true, service: "niu-api", runtime: "vercel", build: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown" });
  }
  try {
    appPromise ??= loadApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    if (reply.headersSent) return;
    return reply.status(500).type("application/json").json({ success: false, error: safeErrorMessage(error) });
  }
}
