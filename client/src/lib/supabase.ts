import { createClient } from "@supabase/supabase-js";

// Supabase publishable credentials are intended for browser delivery; access to
// institutional data remains governed by Supabase Auth and row-level policies.
// Environment values retain precedence so the deployment can be reconfigured
// without a code change, while the deployed public client stays usable on Vercel.
const fallbackSupabaseUrl = "https://oevgnonkqpvfvjsmovpw.supabase.co";
const fallbackSupabasePublishableKey = "sb_publishable_VWi5wUQVYpe5kQ3Csd2bOg_UgsaOGHe";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackSupabasePublishableKey;

export const supabaseConfigured = true;
export const supabase = createClient(supabaseUrl, supabasePublishableKey);
