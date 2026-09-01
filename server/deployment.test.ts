import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("external deployment branding", () => {
  it("publishes branded browser and social-discovery metadata", () => {
    const html = fs.readFileSync(path.join(root, "client", "index.html"), "utf8");
    expect(html).toContain('rel="icon" href="/favicon.svg"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it("includes the Vercel entry point and static output configuration", () => {
    const config = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
    expect(config).toContain('"api/index.js"');
    expect(config).toContain('"outputDirectory": "dist/public"');
    expect(config).toContain('"destination": "/index.html"');
    expect(fs.existsSync(path.join(root, "api", "index.js"))).toBe(true);
    expect(fs.existsSync(path.join(root, "api", "index.source.ts"))).toBe(true);
  });

  it("keeps the public Supabase client initialized when Vercel Vite variables are absent", () => {
    const config = fs.readFileSync(path.join(root, "client", "src", "lib", "supabase.ts"), "utf8");
    expect(config).toContain("fallbackSupabaseUrl");
    expect(config).toContain("fallbackSupabasePublishableKey");
    expect(config).toContain("export const supabaseConfigured = true");
  });

  it("uses the same fallback-aware Supabase configuration on the server", async () => {
    const config = fs.readFileSync(path.join(root, "server", "niuSupabase.ts"), "utf8");
    expect(config).toContain("fallbackNiuSupabaseUrl");
    expect(config).toContain("fallbackNiuSupabasePublishableKey");
    expect(config).toContain("process.env.VITE_SUPABASE_URL || fallbackNiuSupabaseUrl");
    expect(config).toContain("process.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackNiuSupabasePublishableKey");
  });

  it("offers a Supabase email-link fallback for deployed access when Google OAuth needs external configuration", () => {
    const signInPage = fs.readFileSync(path.join(root, "client", "src", "pages", "SignIn.tsx"), "utf8");
    const authGate = fs.readFileSync(path.join(root, "docs", "supabase", "20260826_niu_auth_allowlist_gate.sql"), "utf8");
    expect(signInPage).toContain("signInWithOAuth");
    expect(signInPage).toContain("/auth/callback");
    expect(signInPage).toContain("signInWithOtp");
    expect(signInPage).toContain("shouldCreateUser: true");
    expect(signInPage).toContain("emailRedirectTo: `${window.location.origin}/portal`");
    expect(signInPage).toContain("redirectTo: `${window.location.origin}/auth/callback`");
    expect(signInPage).not.toContain("localhost");
    expect(signInPage).toContain("Email account link");

    const callbackPage = fs.readFileSync(path.join(root, "client", "src", "pages", "AuthCallback.tsx"), "utf8");
    expect(callbackPage).toContain("getSession");
    expect(callbackPage).toContain("exchangeCodeForSession");
    expect(callbackPage).toContain('setLocation("/portal"');
    expect(authGate).toContain("before insert on auth.users");
    expect(authGate).toContain("admin_allowlist");
  });
});
