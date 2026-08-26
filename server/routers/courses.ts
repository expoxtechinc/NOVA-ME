import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

function publicSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The NIU public database connection is not configured." });
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const courseRouter = router({
  list: publicProcedure.input(z.object({ search: z.string().trim().max(80).optional().default("") })).query(async ({ input }) => {
    const search = input.search.replace(/[%,_()]/g, "");
    let query = publicSupabaseClient().from("courses").select("id, slug, title, description, category, level, duration_minutes").eq("status", "published").order("title", { ascending: true }).limit(24);
    if (search) query = query.or(`title.ilike.%${search}%,category.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Course discovery is temporarily unavailable." });
    return data ?? [];
  }),
});
