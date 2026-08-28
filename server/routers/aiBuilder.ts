import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { storagePut } from "../storage";
import { analyzeCurriculumDocument } from "../../shared/curriculumImport";
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

type Blueprint = { programme: { title: string; description: string; difficulty: string; objectives: string[]; learningOutcomes: string[]; entryRequirements: string[]; completionRequirements: string[]; recommendedLearningHours: number }; courses: Array<{ title: string; description: string; difficulty: string; position: number; objectives: string[]; modules: Array<{ title: string; description: string; difficulty: string; position: number; objectives: string[]; lessons: Array<{ title: string; description: string; position: number; objectives: string[]; activityIdeas: string[]; materialNeeds: string[]; assessmentIdeas: string[] }> }> }> };

function blueprintToMarkdown(topic: string, blueprint: Blueprint, sources: Array<{ title: string; url: string; sourceType: string }>, notes: string) {
  const lines = [`# Department: ${topic.slice(0, 80)} Academic Development`, `# Programme: ${blueprint.programme.title}`, `Description: ${blueprint.programme.description}`, `Difficulty: ${blueprint.programme.difficulty}`, `Learning hours: ${blueprint.programme.recommendedLearningHours}`, `Objectives: ${blueprint.programme.objectives.join("; ")}`, `Learning outcomes: ${blueprint.programme.learningOutcomes.join("; ")}`, `Entry requirements: ${blueprint.programme.entryRequirements.join("; ")}`, `Completion requirements: ${blueprint.programme.completionRequirements.join("; ")}`, "", `Research review: ${notes}`, `Research sources: ${sources.map(source => `${source.title} (${source.sourceType}) — ${source.url}`).join("; ")}`, ""];
  for (const course of blueprint.courses.slice().sort((a, b) => a.position - b.position)) {
    lines.push(`## Course: ${course.title}`, `Description: ${course.description}`, `Difficulty: ${course.difficulty}`, `Objective: ${course.objectives.join("; ")}`);
    for (const module of course.modules.slice().sort((a, b) => a.position - b.position)) {
      lines.push(`### Module ${module.position}: ${module.title}`, `Description: ${module.description}`, `Difficulty: ${module.difficulty}`, `Objective: ${module.objectives.join("; ")}`);
      for (const lesson of module.lessons.slice().sort((a, b) => a.position - b.position)) {
        lines.push(`#### Lesson ${lesson.position}: ${lesson.title}`, `Description: ${lesson.description}`, `Objective: ${lesson.objectives.join("; ")}`, `Activity: ${lesson.activityIdeas.join("; ")}`, `Material: ${lesson.materialNeeds.join("; ")}`, `Assessment: ${lesson.assessmentIdeas.join("; ")}`);
      }
    }
  }
  return lines.join("\\n");
}

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
  saveBlueprintEdits: publicProcedure.input(z.object({ jobId: z.string().uuid(), blueprint: z.record(z.string(), z.unknown()) })).mutation(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data, error } = await supabase.from("ai_academic_builder_jobs").update({ blueprint: input.blueprint }).eq("id", input.jobId).in("status", ["research_review", "generation_review", "ready_for_review"]).select("id,status,blueprint").maybeSingle();
    if (error || !data) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Blueprint editing is available only while the AI Builder job remains in a private review state." });
    return data;
  }),
  generateReviewPlans: publicProcedure.input(z.object({ jobId: z.string().uuid(), evidence: z.array(z.object({ sourceUrl: z.string().url().refine(value => value.startsWith("https://"), "Evidence sources must use HTTPS URLs"), excerpt: z.string().trim().min(20).max(4000), claimAreas: z.array(z.string().trim().min(2).max(160)).min(1).max(12) })).min(1).max(40) })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error: jobError } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,blueprint,research_sources,research_notes,settings").eq("id", input.jobId).eq("status", "generation_review").maybeSingle();
    if (jobError || !job) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Generation planning is blocked until research review is complete." });
    const settings = (job.settings ?? {}) as { researchDepth?: string };
    const uniqueSources = new Set(input.evidence.map(item => item.sourceUrl));
    if (settings.researchDepth === "deep" && (input.evidence.length < 3 || uniqueSources.size < 3)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Deep research planning requires at least three distinct HTTPS evidence sources with excerpts." });
    const result = await invokeLLM({ model: "gpt-5-mini", messages: [{ role: "system", content: "You are NIU's evidence-bound academic planning assistant. Produce only reviewable plans, never final teaching claims. Use only the supplied blueprint and evidence excerpts. Do not add facts not present in evidence. Every item must include source URLs or an explicit verification label. NIU offers certificate programmes only. Return JSON exactly matching the schema." }, { role: "user", content: JSON.stringify({ topic: job.topic, blueprint: job.blueprint, researchSources: job.research_sources, researchNotes: job.research_notes, evidence: input.evidence }) }], response_format: { type: "json_schema", json_schema: { name: "niu_ai_review_plans", strict: true, schema: { type: "object", additionalProperties: false, properties: { contentPlan: { type: "array", items: { type: "object", additionalProperties: false, properties: { section: { type: "string" }, draftPurpose: { type: "string" }, evidenceUrls: { type: "array", items: { type: "string" } }, verificationRequired: { type: "boolean" } }, required: ["section", "draftPurpose", "evidenceUrls", "verificationRequired"] } }, visualPlan: { type: "array", items: { type: "object", additionalProperties: false, properties: { placement: { type: "string" }, purpose: { type: "string" }, altText: { type: "string" }, accessibilityChecks: { type: "array", items: { type: "string" } }, verificationRequired: { type: "boolean" } }, required: ["placement", "purpose", "altText", "accessibilityChecks", "verificationRequired"] } }, assessmentBlueprint: { type: "object", additionalProperties: false, properties: { passingScore: { type: "integer" }, attemptLimit: { type: "integer" }, questions: { type: "array", items: { type: "object", additionalProperties: false, properties: { promptPurpose: { type: "string" }, objective: { type: "string" }, difficulty: { type: "string", enum: ["introductory", "intermediate", "advanced"] }, points: { type: "integer" }, answerKeyStatus: { type: "string" }, verificationRequired: { type: "boolean" } }, required: ["promptPurpose", "objective", "difficulty", "points", "answerKeyStatus", "verificationRequired"] } } }, required: ["passingScore", "attemptLimit", "questions"] }, missingEvidence: { type: "array", items: { type: "string" } } }, required: ["contentPlan", "visualPlan", "assessmentBlueprint", "missingEvidence"] } } }, maxTokens: 10000 });
    const raw = result.choices[0]?.message.content;
    if (typeof raw !== "string") throw new TRPCError({ code: "BAD_GATEWAY", message: "The evidence-bound planning engine returned no structured plan." });
    const plans = JSON.parse(raw);
    const { error: updateError } = await supabase.from("ai_academic_builder_jobs").update({ research_evidence: input.evidence, content_plan: plans.contentPlan, visual_plan: plans.visualPlan, assessment_blueprint: plans.assessmentBlueprint, missing_information: plans.missingEvidence ?? [], generated_by: userId, generated_at: new Date().toISOString(), status: "ready_for_review" }).eq("id", job.id).eq("status", "generation_review");
    if (updateError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: updateError.message });
    return { jobId: job.id, status: "ready_for_review" as const, plans };
  }),
  handoffToCurriculumImport: publicProcedure.input(z.object({ jobId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error: jobError } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,blueprint,research_sources,research_notes").eq("id", input.jobId).in("status", ["generation_review", "ready_for_review"]).maybeSingle();
    if (jobError || !job) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Draft handoff is blocked until the AI Builder job has completed research review or evidence-bound generation planning." });
    const blueprint = job.blueprint as Blueprint | null;
    const sources = Array.isArray(job.research_sources) ? job.research_sources : [];
    const notes = typeof job.research_notes === "string" ? job.research_notes : "";
    if (!blueprint || sources.length < 1 || notes.length < 20) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Draft handoff requires a blueprint, at least one reviewed HTTPS source, and research notes." });
    const sourceText = blueprintToMarkdown(job.topic, blueprint, sources, notes);
    const parsed = analyzeCurriculumDocument(sourceText, `ai-builder-${job.id}.md`);
    if (parsed.validationErrors.length || parsed.missingInformation.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Draft handoff is blocked because the generated source still has validation or missing-information markers." });
    const uploaded = await storagePut(`ai-builder/${job.id}.md`, sourceText, "text/markdown");
    const { data: inserted, error: insertError } = await supabase.from("curriculum_imports").insert({ source_file_name: `ai-builder-${job.id}.md`, source_mime_type: "text/markdown", source_storage_path: uploaded.key, status: "uploaded", analysis: parsed, validation_errors: parsed.validationErrors, missing_information: parsed.missingInformation, review_notes: notes, created_by: userId }).select("id,status,source_file_name,analysis,validation_errors,missing_information").single();
    if (insertError || !inserted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: insertError?.message ?? "The private AI Builder handoff could not be saved." });
    const { error: updateError } = await supabase.from("curriculum_imports").update({ status: "generated" }).eq("id", inserted.id);
    if (updateError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: updateError.message });
    const { error: jobUpdateError } = await supabase.from("ai_academic_builder_jobs").update({ status: "ready_for_review", draft_artifact: { importId: inserted.id, storagePath: uploaded.key }, generated_at: new Date().toISOString(), generated_by: userId }).eq("id", job.id).eq("status", "generation_review");
    if (jobUpdateError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: jobUpdateError.message });
    return { jobId: job.id, importId: inserted.id, status: "ready_for_review" as const };
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
