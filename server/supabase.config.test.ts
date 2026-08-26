import { describe, expect, it } from "vitest";

describe("Supabase public configuration", () => {
  it("accepts the configured publishable key for the project settings endpoint", async () => {
    const baseUrl = process.env.VITE_SUPABASE_URL;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
