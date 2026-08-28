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
  try {
    appPromise ??= loadApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    if (res.headersSent) return;
    return res.status(500).type("application/json").json({ success: false, error: safeErrorMessage(error) });
  }
}
