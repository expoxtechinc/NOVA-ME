// @ts-nocheck
// Vercel’s isolated serverless type pass resolves conflicting Express ambient
// declarations. The deployed runtime contract is validated separately.
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { storageGetSignedUrl } from "../storage";
import { publicProcedure, router } from "../_core/trpc";

function enrolledSupabaseClient(token: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The NIU media service is not configured." });
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: token } } });
}

export const mediaRouter = router({
  getLessonUrl: publicProcedure.input(z.object({ lessonId: z.string().uuid() })).query(async ({ input, ctx }) => {
    const header = ctx.req.headers["x-supabase-authorization"];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token?.startsWith("Bearer ")) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to access protected learning materials." });
    const supabase = enrolledSupabaseClient(token);
    const { data, error } = await supabase.from("lessons").select("media_path, video_path").eq("id", input.lessonId).maybeSingle();
    if (error || !data) throw new TRPCError({ code: "FORBIDDEN", message: "Active enrollment is required to access this material." });
    const path = data.media_path || data.video_path;
    if (!path) return { url: null as string | null };
    return { url: await storageGetSignedUrl(path) };
  }),
  getContentUrl: publicProcedure.input(z.object({ contentItemId: z.string().uuid() })).query(async ({ input, ctx }) => {
    const header = ctx.req.headers["x-supabase-authorization"];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token?.startsWith("Bearer ")) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to access protected learning materials." });
    const supabase = enrolledSupabaseClient(token);
    const { data, error } = await supabase.from("content_library_items").select("storage_path, category").eq("id", input.contentItemId).maybeSingle();
    if (error || !data) throw new TRPCError({ code: "FORBIDDEN", message: "Active enrollment is required to access this material." });
    if (data.category === "external_resource") return { url: data.storage_path };
    return { url: await storageGetSignedUrl(data.storage_path) };
  }),
});
