import { describe, expect, it, vi } from "vitest";
import handler, { sendJson } from "../api/index.source";

describe("Vercel API entrypoint", () => {
  it("serializes health responses through a native Vercel response", async () => {
    const response = {
      statusCode: 0,
      headersSent: false,
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await handler({ url: "/api/healthz?check=1" } as never, response as never);

    expect(response.statusCode).toBe(200);
    expect(response.setHeader).toHaveBeenCalledWith("content-type", "application/json; charset=utf-8");
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"success":true'));
  });

  it("returns JSON through the native fallback without Express-only type chaining", () => {
    const response = {
      statusCode: 0,
      headersSent: false,
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    sendJson(response as never, 500, { success: false, error: "NIU server request failed." });

    expect(response.statusCode).toBe(500);
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ success: false, error: "NIU server request failed." }));
  });
});
