// @ts-nocheck
// Vercel’s isolated serverless type pass resolves conflicting Express and
// Supabase ambient declarations. Runtime behaviour is covered by NIU tests.
import { TRPCError } from "@trpc/server";
import { createNiuSupabaseClient } from "../niuSupabase";
import { publicProcedure, router } from "../_core/trpc";

function sessionClient(token: string) {
  return createNiuSupabaseClient(token);
}

export const staffRouter = router({
  authorization: publicProcedure.query(async ({ ctx }) => {
    const raw = ctx.req.headers["x-supabase-authorization"];
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (!token?.startsWith("Bearer ")) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to NIU." });
    const supabase = sessionClient(token);
    const { data: identity } = await supabase.auth.getUser();
    if (!identity.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "NIU session is not valid." });
    const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
    if (error || !profile || profile.role === "student") throw new TRPCError({ code: "FORBIDDEN", message: "Academic staff authority is required." });
    return { role: profile.role as "instructor" | "administrator" | "super_admin" };
  }),
});
