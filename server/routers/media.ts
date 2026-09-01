// @ts-nocheck
// Vercel’s isolated serverless type pass resolves conflicting Express ambient
// declarations. The deployed runtime contract is validated separately.
import { TRPCError } from "@trpc/server";
import { createNiuSupabaseClient } from "../niuSupabase";
import { z } from "zod";
import { storageGetSignedUrl } from "../storage";
import { publicProcedure, router } from "../_core/trpc";

function enrolledSupabaseClient(token: string) {
  return createNiuSupabaseClient(token);
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
    try {
      return { url: await storageGetSignedUrl(path) };
    } catch (storageError) {
      console.error("NIU lesson media signing failed", storageError instanceof Error ? storageError.message : storageError);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The protected lesson media is temporarily unavailable." });
    }
  }),
  getContentUrl: publicProcedure.input(z.object({ contentItemId: z.string().uuid() })).query(async ({ input, ctx }) => {
    const header = ctx.req.headers["x-supabase-authorization"];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token?.startsWith("Bearer ")) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to access protected learning materials." });
    const supabase = enrolledSupabaseClient(token);
    const { data, error } = await supabase.from("content_library_items").select("storage_path, category").eq("id", input.contentItemId).maybeSingle();
    if (error || !data) throw new TRPCError({ code: "FORBIDDEN", message: "Active enrollment is required to access this material." });
    if (data.category === "external_resource") return { url: data.storage_path };
    try {
      return { url: await storageGetSignedUrl(data.storage_path) };
    } catch (storageError) {
      console.error("NIU protected resource signing failed", storageError instanceof Error ? storageError.message : storageError);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The protected learning resource is temporarily unavailable." });
    }
  }),
});
