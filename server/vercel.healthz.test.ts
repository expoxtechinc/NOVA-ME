import { describe, expect, it, vi } from "vitest";
import handler from "../api/healthz";

describe("vercel health endpoint", () => {
  it("returns a JSON-safe healthy response without loading the app", () => {
    const json = vi.fn();
    const res = {
      status: vi.fn(() => ({ json })),
    };

    handler({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      service: "niu-api",
      runtime: "vercel",
      build: "unknown",
    });
  });
});
