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

export function sendJson(res: Response, statusCode: number, body: unknown) {
  const reply = res as Response & {
    statusCode: number;
    setHeader?: (name: string, value: string) => void;
    end?: (chunk?: string) => void;
  };
  if (reply.headersSent) return;
  reply.statusCode = statusCode;
  reply.setHeader?.("content-type", "application/json; charset=utf-8");
  reply.end?.(JSON.stringify(body));
}

export default async function handler(req: Request, res: Response) {
  if (req.url?.split("?")[0] === "/api/healthz") {
    return sendJson(res, 200, { success: true, service: "niu-api", runtime: "vercel", build: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown" });
  }
  try {
    appPromise ??= loadApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    return sendJson(res, 500, { success: false, error: safeErrorMessage(error) });
  }
}
