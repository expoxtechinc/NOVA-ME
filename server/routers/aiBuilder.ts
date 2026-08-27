import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

const settingsSchema = z.object({
  department: z.string().trim().max(160).optional(),
  difficulty: z.enum(["introductory", "intermediate", "advanced"]).optional(),
  learningHours: z.number().int().positive().max(2000).optional(),
  academicDepth: z.enum(["foundation", "applied", "advanced"]).optional(),
  targetLearner: z.string().trim().max(240).optional(),
  numberOfCourses: z.number().int().positive().max(24).optional(),
  researchDepth: z.enum(["standard", "deep"]).optional(),
  visualGeneration: z.boolean().default(false),
  assessmentGeneration: z.boolean().default(true),
  referenceRequirements: z.string().trim().max(1200).optional(),
});

type StaffSession = { supabase: ReturnType<typeof createClient<any>>; userId: string };

async function getStaffSession(req: { headers: Record<string, string | string[] | undefined> }): Promise<StaffSession> {
  const raw = req.headers["x-supabase-authorization"];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token?.startsWith("Bearer ")) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to NIU." });
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NIU identity service is not configured." });
  const supabase = createClient<any>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: token } } });
  const { data: identity } = await supabase.auth.getUser();
  if (!identity.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "NIU session is not valid." });
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
  if (error || !profile || !["instructor", "administrator", "super_admin"].includes(profile.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Academic staff authority is required." });
  return { supabase, userId: identity.user.id };
}

const blueprintSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    programme: {
      type: "object", additionalProperties: false,
      properties: {
        title: { type: "string" }, description: { type: "string" }, difficulty: { type: "string", enum: ["introductory", "intermediate", "advanced"] }, objectives: { type: "array", items: { type: "string" } }, learningOutcomes: { type: "array", items: { type: "string" } }, entryRequirements: { type: "array", items: { type: "string" } }, completionRequirements: { type: "array", items: { type: "string" } }, recommendedLearningHours: { type: "integer" },
      }, required: ["title", "description", "difficulty", "objectives", "learningOutcomes", "entryRequirements", "completionRequirements", "recommendedLearningHours"],
    },
    courses: {
      type: "array", items: { type: "object", additionalProperties: false,
        properties: {
          title: { type: "string" }, description: { type: "string" }, difficulty: { type: "string", enum: ["introductory", "intermediate", "advanced"] }, position: { type: "integer" }, objectives: { type: "array", items: { type: "string" } }, modules: { type: "array", items: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, description: { type: "string" }, difficulty: { type: "string", enum: ["introductory", "intermediate", "advanced"] }, position: { type: "integer" }, objectives: { type: "array", items: { type: "string" } }, lessons: { type: "array", items: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, description: { type: "string" }, position: { type: "integer" }, objectives: { type: "array", items: { type: "string" } }, activityIdeas: { type: "array", items: { type: "string" } }, materialNeeds: { type: "array", items: { type: "string" } }, assessmentIdeas: { type: "array", items: { type: "string" } } }, required: ["title", "description", "position", "objectives", "activityIdeas", "materialNeeds", "assessmentIdeas"] } } }, required: ["title", "description", "difficulty", "position", "objectives", "lessons"] } } }, required: ["title", "description", "difficulty", "position", "objectives", "modules"] },
    },
    researchPlan: { type: "array", items: { type: "object", additionalProperties: false, properties: { claimArea: { type: "string" }, sourceTypes: { type: "array", items: { type: "string" } }, searchQuestions: { type: "array", items: { type: "string" } }, sourceRequiredBeforeWriting: { type: "boolean" } }, required: ["claimArea", "sourceTypes", "searchQuestions", "sourceRequiredBeforeWriting"] } },
    qualityGates: { type: "array", items: { type: "string" } },
    missingInformation: { type: "array", items: { type: "string" } },
  },
  required: ["programme", "courses", "researchPlan", "qualityGates", "missingInformation"],
};

const sourceSchema = z.object({ title: z.string().trim().min(2).max(240), url: z.string().url().refine(value => value.startsWith("https://"), "Sources must use HTTPS URLs"), sourceType: z.string().trim().min(2).max(120) });

export const aiBuilderRouter = router({
  listJobs: publicProcedure.query(async ({ ctx }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data, error } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,settings,blueprint,research_plan,validation_errors,missing_information,created_at,updated_at").order("updated_at", { ascending: false }).limit(20);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "NIU could not load saved AI Builder planning jobs." });
    return data ?? [];
  }),
  getJob: publicProcedure.input(z.object({ jobId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data, error } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,settings,blueprint,research_plan,validation_errors,missing_information,created_at,updated_at").eq("id", input.jobId).maybeSingle();
    if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "That AI Builder planning job is not available." });
    return data;
  }),
  submitResearchReview: publicProcedure.input(z.object({ jobId: z.string().uuid(), researchSources: z.array(sourceSchema).min(1).max(40), researchNotes: z.string().trim().min(20).max(12000) })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data, error } = await supabase.from("ai_academic_builder_jobs").update({ research_sources: input.researchSources, research_notes: input.researchNotes, status: "generation_review", reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", input.jobId).eq("status", "research_review").select("id,status,research_sources,research_notes").maybeSingle();
    if (error || !data) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error?.message ?? "Research review is blocked until the saved job is in Research Review status." });
    return data;
  }),
  createPlan: publicProcedure.input(z.object({ topic: z.string().trim().min(3).max(240), settings: settingsSchema })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error: jobError } = await supabase.from("ai_academic_builder_jobs").insert({ topic: input.topic, settings: input.settings, status: "planning", created_by: userId }).select("id").single() as { data: { id: string } | null; error: Error | null };
    if (jobError || !job) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The AI Builder planning job could not be started." });
    try {
      const result = await invokeLLM({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: "You are NIU's curriculum architect. NIU offers certificate programmes only. Create a planning blueprint, not publishable academic records. Use only the topic and explicit settings. Do not invent references, research findings, accreditation, licensing, employment, or recognition claims. When evidence is needed, create a research plan and mark it as required before writing. Use only introductory, intermediate, or advanced difficulty. Return JSON matching the schema exactly." },
          { role: "user", content: `Programme topic: ${input.topic}\nSettings: ${JSON.stringify(input.settings)}\nDesign a coherent progression from foundation to assessment. Choose course/module/lesson counts based on subject complexity. Mark missing information rather than guessing. Keep all generated content clearly a draft blueprint for administrator review.` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "niu_ai_academic_blueprint", strict: true, schema: blueprintSchema } },
        maxTokens: 12000,
      });
      const raw = result.choices[0]?.message.content;
      if (typeof raw !== "string") throw new Error("The AI Builder returned no structured blueprint.");
      const blueprint = JSON.parse(raw) as Record<string, unknown>;
      const { error: updateError } = await supabase.from("ai_academic_builder_jobs").update({ status: "research_review", blueprint, research_plan: blueprint.researchPlan ?? [], missing_information: blueprint.missingInformation ?? [], validation_errors: [], reviewed_at: null, reviewed_by: null }).eq("id", job.id) as { error: Error | null };
      if (updateError) throw updateError;
      return { jobId: job.id, status: "research_review" as const, blueprint };
    } catch (error) {
      await supabase.from("ai_academic_builder_jobs").update({ status: "failed", validation_errors: [{ message: error instanceof Error ? error.message : "The AI Builder could not complete planning." }] }).eq("id", job.id);
      throw new TRPCError({ code: "BAD_GATEWAY", message: "NIU could not complete the AI planning stage. No academic records were created." });
    }
  }),
});
