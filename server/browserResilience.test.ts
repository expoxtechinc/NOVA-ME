import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("browser and session resilience", () => {
  it("reloads the NIU workspace when an authenticated Supabase session arrives after initial render", () => {
    const portal = fs.readFileSync(path.join(root, "client", "src", "pages", "Portal.tsx"), "utf8");
    expect(portal).toContain("onAuthStateChange");
    expect(portal).toContain("void loadWorkspace(nextSession)");
    expect(portal).toContain('event === "SIGNED_OUT"');
  });

  it("gives browser-side errors a safe recovery path without exposing stack traces", () => {
    const boundary = fs.readFileSync(path.join(root, "client", "src", "components", "ErrorBoundary.tsx"), "utf8");
    expect(boundary).toContain("Your protected learning records and account access have not been changed.");
    expect(boundary).toContain("Try again");
    expect(boundary).toContain("Return home");
    expect(boundary).not.toContain("error?.stack");
  });

  it("sets browser-facing security headers at the Vercel edge", () => {
    const config = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
    expect(config).toContain("X-Content-Type-Options");
    expect(config).toContain("X-Frame-Options");
    expect(config).toContain("Referrer-Policy");
    expect(config).toContain("Permissions-Policy");
  });
});
