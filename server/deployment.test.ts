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
    expect(config).toContain('"api/index.ts"');
    expect(config).toContain('"outputDirectory": "dist/public"');
    expect(config).toContain('"destination": "/index.html"');
    expect(fs.existsSync(path.join(root, "api", "index.ts"))).toBe(true);
  });

  it("keeps the public Supabase client initialized when Vercel Vite variables are absent", () => {
    const config = fs.readFileSync(path.join(root, "client", "src", "lib", "supabase.ts"), "utf8");
    expect(config).toContain("fallbackSupabaseUrl");
    expect(config).toContain("fallbackSupabasePublishableKey");
    expect(config).toContain("export const supabaseConfigured = true");
  });

  it("offers a Supabase email-link fallback for deployed access when Google OAuth needs external configuration", () => {
    const signInPage = fs.readFileSync(path.join(root, "client", "src", "pages", "SignIn.tsx"), "utf8");
    expect(signInPage).toContain("signInWithOtp");
    expect(signInPage).toContain("emailRedirectTo");
    expect(signInPage).toContain("Email sign-in link");
  });
});
