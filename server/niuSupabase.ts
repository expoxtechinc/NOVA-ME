import { createClient } from "@supabase/supabase-js";

// These are publishable Supabase credentials. They are safe for browser/server
// public clients because every protected operation remains governed by Auth and
// Supabase RLS. Deployment variables still take precedence for key rotation.
export const fallbackNiuSupabaseUrl = "https://oevgnonkqpvfvjsmovpw.supabase.co";
export const fallbackNiuSupabasePublishableKey = "sb_publishable_VWi5wUQVYpe5kQ3Csd2bOg_UgsaOGHe";

export function niuSupabaseConfig() {
  return {
    url: process.env.VITE_SUPABASE_URL || fallbackNiuSupabaseUrl,
    key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackNiuSupabasePublishableKey,
  };
}

export function createNiuSupabaseClient(token?: string) {
  const { url, key } = niuSupabaseConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(token ? { global: { headers: { Authorization: token } } } : {}),
  });
}
