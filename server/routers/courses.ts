import { TRPCError } from "@trpc/server";
import { createNiuSupabaseClient } from "../niuSupabase";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
function publicSupabaseClient() {
  return createNiuSupabaseClient();
}
export const courseRouter = router({
  list: publicProcedure.input(z.object({ search: z.string().trim().max(80).optional().default("") })).query(async ({ input }) => { const search = input.search.replace(/[%,_()]/g, ""); let query = publicSupabaseClient().from("courses").select("id, slug, title, description, category, level, duration_minutes").eq("status", "published").order("title", { ascending: true }).limit(24); if (search) query = query.or(`title.ilike.%${search}%,category.ilike.%${search}%`); const { data, error } = await query; if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Course discovery is temporarily unavailable." }); return data ?? []; }),
  getPublic: publicProcedure.input(z.object({ slug: z.string().min(1).max(160) })).query(async ({ input }) => { const { data, error } = await publicSupabaseClient().from("courses").select("id, slug, title, description, category, level, duration_minutes, learning_objectives, requirements, certificate_eligible, course_modules(id, title, description, position, lessons(id, title, kind, position, is_required))").eq("slug", input.slug).eq("status", "published").maybeSingle(); if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Course details are temporarily unavailable." }); if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Published course not found." }); return data; }),
});
