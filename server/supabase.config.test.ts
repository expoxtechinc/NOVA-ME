import { describe, expect, it } from "vitest";
import { fallbackNiuSupabasePublishableKey, fallbackNiuSupabaseUrl } from "./niuSupabase";

describe("Supabase public configuration", () => {
  it("accepts the configured publishable key for the project settings endpoint", async () => {
    const baseUrl = process.env.VITE_SUPABASE_URL || fallbackNiuSupabaseUrl;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackNiuSupabasePublishableKey;

    expect(baseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
    expect(publishableKey).toMatch(/^sb_publishable_/);

    const response = await fetch(`${baseUrl}/auth/v1/settings`, {
      headers: { apikey: publishableKey! },
    });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
    expect(response.ok).toBe(true);
  });
});
