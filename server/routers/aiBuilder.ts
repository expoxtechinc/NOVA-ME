import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { storagePut } from "../storage";
import { analyzeCurriculumDocument } from "../../shared/curriculumImport";
import { createClient } from "@supabase/supabase-js";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { runStructuredAI } from "../aiOrchestrator";
import { generateImage } from "../_core/imageGeneration";

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
const visualSpecSchema = { type: "object", additionalProperties: false, properties: { lessonTitle: { type: "string" }, shouldGenerate: { type: "boolean" }, visualType: { type: "string" }, concept: { type: "string" }, learningObjective: { type: "string" }, requiredStructures: { type: "array", items: { type: "string" } }, requiredLabels: { type: "array", items: { type: "string" } }, layout: { type: "string" }, orientation: { type: "string" }, educationalPurpose: { type: "string" }, altText: { type: "string" }, accuracyRequirements: { type: "array", items: { type: "string" } }, accessibilityRequirements: { type: "array", items: { type: "string" } }, reviewStatus: { type: "string", enum: ["draft", "needs_review"] } }, required: ["lessonTitle", "shouldGenerate", "visualType", "concept", "learningObjective", "requiredStructures", "requiredLabels", "layout", "orientation", "educationalPurpose", "altText", "accuracyRequirements", "accessibilityRequirements", "reviewStatus"] };

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

function compileCompleteDraftPackage(topic: string, blueprint: Blueprint, reviewPlans: any, storagePaths: Array<{ fileName: string; storagePath: string }>) {
  let materialIndex = 0;
  const courses = (blueprint.courses ?? []).slice().sort((a, b) => a.position - b.position).map((course, courseIndex) => ({
    title: course.title,
    description: course.description,
    difficulty: course.difficulty,
    durationMinutes: Math.max(30, Math.round((blueprint.programme?.recommendedLearningHours ?? 1) * 60 / Math.max(1, blueprint.courses?.length ?? 1))),
    objectives: course.objectives,
    learningOutcomes: course.objectives,
    requirements: blueprint.programme?.entryRequirements ?? [],
    modules: course.modules.slice().sort((a, b) => a.position - b.position).map((module, moduleIndex) => ({
      title: module.title,
      description: module.description,
      difficulty: module.difficulty,
      estimatedMinutes: Math.max(15, Math.round(blueprint.programme?.recommendedLearningHours ? blueprint.programme.recommendedLearningHours * 60 / Math.max(1, course.modules.length) : 60)),
      objectives: module.objectives,
      supportGuidance: "Administrator must verify inclusive support, device access, language, and accommodation guidance before approval.",
      lessons: module.lessons.slice().sort((a, b) => a.position - b.position).map((lesson) => {
        const file = storagePaths[materialIndex++];
        const evidenceLabel = reviewPlans?.contentPlan?.find((item: any) => String(item.section).toLowerCase().includes(lesson.title.toLowerCase()))?.evidenceUrls ?? [];
        return {
          kind: "reading",
          title: lesson.title,
          description: lesson.description,
          draftText: `DRAFT LEARNING MATERIAL — ${lesson.title}\\n\\nThis lesson is an administrator-review draft for ${topic}. Use only verified evidence before approval.\\n\\nLearning objectives\\n${lesson.objectives.map(item => `- ${item}`).join("\\n")}\\n\\nSource evidence to verify\\n${evidenceLabel.length ? evidenceLabel.join("\\n") : "Missing evidence: administrator must attach authoritative sources."}`,
          objectives: lesson.objectives,
          activities: lesson.activityIdeas,
          accessibility: ["Provide an accessible text alternative.", "Verify headings, contrast, captions/transcripts, and keyboard access."],
          videoScript: "Missing: administrator must author a video script if video is required.",
          transcript: "Missing: administrator must author or verify a transcript.",
          diagrams: [],
          references: evidenceLabel,
          assignment: "Missing: administrator must define an assignment if required.",
          rubric: "Missing: administrator must define and approve a rubric if required.",
          materials: file ? [{ title: `${lesson.title} draft study guide`, fileName: file.fileName, storagePath: file.storagePath, description: "Private AI Builder draft study guide; administrator must verify and edit before approval." }] : [],
          assessment: { assessmentIdeas: lesson.assessmentIdeas, verificationRequired: true },
          estimatedMinutes: 30,
          points: 10,
        };
      }),
      assessments: [{
        title: `${module.title} knowledge check`,
        type: "knowledge_check",
        instructions: "Draft assessment blueprint. Administrator must review every item, answer key, points, and objective mapping before approval.",
        passingScore: reviewPlans?.assessmentBlueprint?.passingScore ?? 70,
        attemptLimit: reviewPlans?.assessmentBlueprint?.attemptLimit ?? 2,
        questionBankTitle: `${module.title} Question Bank`,
        questions: (reviewPlans?.assessmentBlueprint?.questions ?? []).slice(0, 5).map((item: any, questionIndex: number) => ({
          prompt: `Draft question purpose: ${item.promptPurpose}. Administrator must author and verify the final question before approval.`,
          choices: ["Draft option pending authoring", "Draft option pending authoring", "Draft option pending authoring", "Draft option pending authoring"],
          answerKey: { status: "pending_administrator_verification" },
          explanation: "Answer key intentionally withheld pending authorised academic review.",
          difficulty: item.difficulty,
          topic: module.title,
          objective: item.objective,
          points: Math.max(1, item.points ?? 1),
        }))
      }],
    })),
  }));
  return {
    school: { name: "NIU Academic Development" },
    department: { name: blueprint.programme?.title ? `${blueprint.programme.title} Academic Development` : `${topic} Academic Development` },
    programme: { title: blueprint.programme?.title ?? topic, description: blueprint.programme?.description ?? "Draft certificate programme; administrator verification required.", difficulty: blueprint.programme?.difficulty ?? "intermediate", objectives: blueprint.programme?.objectives ?? [], learningOutcomes: blueprint.programme?.learningOutcomes ?? [], learningHours: blueprint.programme?.recommendedLearningHours ?? 0, completionRequirements: blueprint.programme?.completionRequirements ?? [], certificateTemplateKey: "administrator_review_required" },
    courses,
  };
}

export const aiBuilderRouter = router({
  listJobs: publicProcedure.query(async ({ ctx }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data, error } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,settings,blueprint,research_plan,validation_errors,missing_information,generated_record_ids,created_at,updated_at").order("updated_at", { ascending: false }).limit(20);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "NIU could not load saved AI Builder planning jobs." });
    return data ?? [];
  }),
  getJob: publicProcedure.input(z.object({ jobId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data, error } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,settings,blueprint,research_plan,validation_errors,missing_information,generated_record_ids,created_at,updated_at").eq("id", input.jobId).maybeSingle();
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
  generateVisualSpecifications: publicProcedure.input(z.object({ jobId: z.string().uuid(), lessons: z.array(z.object({ lessonTitle: z.string().trim().min(2).max(240), lessonDescription: z.string().trim().min(2).max(4000), learningObjective: z.string().trim().min(2).max(500), evidenceUrls: z.array(z.string().url().refine(value => value.startsWith("https://"), "Visual evidence URLs must use HTTPS")).max(12) })).min(1).max(120) })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,visual_plan").eq("id", input.jobId).in("status", ["generation_review", "ready_for_review"]).maybeSingle();
    if (error || !job) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Visual planning is available only for a reviewed private AI Builder job." });
    const result = await runStructuredAI<{ specifications: Array<Record<string, unknown>> }>({
      provider: "gemini",
      system: "You are NIU's evidence-bound visual learning architect. Decide whether each lesson benefits from a learning-support visual. Do not invent factual labels, sources, measurements, anatomy, scientific structures, or claims. If evidence is insufficient, set shouldGenerate false and explain the missing evidence. Prefer deterministic diagrams or flowcharts for exact relationships and mark every specification needs_review. Return JSON only.",
      prompt: JSON.stringify({ topic: job.topic, lessons: input.lessons }),
      schema: { type: "object", additionalProperties: false, properties: { specifications: { type: "array", items: visualSpecSchema } }, required: ["specifications"] },
    });
    const specifications = result.value.specifications;
    const { error: updateError } = await supabase.from("ai_academic_builder_jobs").update({ visual_plan: specifications, generated_by: userId, generated_at: new Date().toISOString() }).eq("id", job.id).in("status", ["generation_review", "ready_for_review"]);
    if (updateError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Visual specifications could not be saved." });
    return { jobId: job.id, provider: result.provider, model: result.model, specifications, status: job.status };
  }),
  generateVisualAssets: publicProcedure.input(z.object({ jobId: z.string().uuid(), assets: z.array(z.object({ lessonId: z.string().uuid(), moduleId: z.string().uuid(), programmeId: z.string().uuid().nullable().optional(), lessonTitle: z.string().trim().min(2).max(240), specification: z.object({ shouldGenerate: z.boolean(), visualType: z.string(), concept: z.string(), learningObjective: z.string(), requiredStructures: z.array(z.string()), requiredLabels: z.array(z.string()), layout: z.string(), orientation: z.string(), educationalPurpose: z.string(), altText: z.string(), accuracyRequirements: z.array(z.string()), accessibilityRequirements: z.array(z.string()), reviewStatus: z.enum(["draft", "needs_review"]) }) })).min(1).max(120) })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error: jobError } = await supabase.from("ai_academic_builder_jobs").select("id,status,topic").eq("id", input.jobId).in("status", ["generation_review", "ready_for_review"]).maybeSingle();
    if (jobError || !job) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Visual generation is available only for a private reviewed AI Builder job." });
    const created: Array<{ lessonId: string; contentItemId: string; visualVersionId: string; status: string }> = [];
    for (const asset of input.assets) {
      if (!asset.specification.shouldGenerate) continue;
      const { data: existing } = await supabase.from("content_library_items").select("id,visual_metadata").eq("is_generated_visual", true).contains("visual_metadata", { jobId: input.jobId, lessonId: asset.lessonId }).limit(1);
      if (existing?.[0]) {
        const { data: existingVersion } = await supabase.from("ai_visual_asset_versions").select("id,review_status").eq("content_item_id", existing[0].id).order("version", { ascending: false }).limit(1).maybeSingle();
        if (existingVersion) created.push({ lessonId: asset.lessonId, contentItemId: existing[0].id, visualVersionId: existingVersion.id, status: existingVersion.review_status });
        continue;
      }
      const prompt = `Original educational ${asset.specification.visualType} for the NIU lesson "${asset.lessonTitle}". Purpose: ${asset.specification.educationalPurpose}. Concept: ${asset.specification.concept}. Learning objective: ${asset.specification.learningObjective}. Required structures: ${asset.specification.requiredStructures.join(", ") || "Missing: administrator must confirm structures."}. Required labels: ${asset.specification.requiredLabels.join(", ") || "Missing: administrator must confirm labels."}. Layout: ${asset.specification.layout}. Orientation: ${asset.specification.orientation}. Accuracy requirements: ${asset.specification.accuracyRequirements.join("; ")}. Do not invent facts or labels. Use no decorative imagery. Keep any text large and minimal; the administrator will verify all content before publication.`;
      const image = await generateImage({ prompt, model: "MODEL_GPT_IMAGE_2", quality: "medium" });
      if (!image.key || !image.url) throw new TRPCError({ code: "BAD_GATEWAY", message: `Visual generation returned no stored image for ${asset.lessonTitle}.` });
      const metadata = { ...asset.specification, jobId: input.jobId, lessonId: asset.lessonId, moduleId: asset.moduleId, source: "NIU AI Visual Learning Engine", generatedBy: userId, generatedAt: new Date().toISOString(), generationPrompt: prompt, storageKey: image.key, storageUrl: image.url };
      const { data: item, error: itemError } = await supabase.from("content_library_items").insert({ title: `${asset.lessonTitle} learning visual`, category: "image", file_name: `${asset.lessonId}-ai-visual.png`, content_type: image.mimeType ?? "image/png", storage_path: image.key, description: asset.specification.educationalPurpose, status: "draft", governed_workflow: true, is_generated_visual: true, visual_metadata: metadata, created_by: userId }).select("id").single();
      if (itemError || !item) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: itemError?.message ?? "The private visual record could not be created." });
      const { error: linkError } = await supabase.from("lesson_content_items").insert({ lesson_id: asset.lessonId, content_item_id: item.id, position: 999, is_required: false });
      if (linkError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: linkError.message });
      const { data: version, error: versionError } = await supabase.from("ai_visual_asset_versions").insert({ content_item_id: item.id, lesson_id: asset.lessonId, module_id: asset.moduleId, programme_id: asset.programmeId ?? null, title: `${asset.lessonTitle} learning visual`, caption: asset.specification.educationalPurpose, alt_text: asset.specification.altText, accessibility_description: asset.specification.accessibilityRequirements.join("; "), educational_purpose: asset.specification.educationalPurpose, generation_model: "MODEL_GPT_IMAGE_2", generation_prompt: prompt, version: 1, change_summary: "Initial AI-generated educational visual draft", review_status: "draft", created_by: userId }).select("id,review_status").single();
      if (versionError || !version) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: versionError?.message ?? "The visual version record could not be created." });
      created.push({ lessonId: asset.lessonId, contentItemId: item.id, visualVersionId: version.id, status: version.review_status });
    }
    return { jobId: job.id, topic: job.topic, created, status: "draft" as const, message: "Generated visuals are private drafts. Academic and accessibility review is required before any approval or publication." };
  }),
  listVisualAssets: publicProcedure.input(z.object({ jobId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data: items, error } = await supabase.from("content_library_items").select("id,title,file_name,content_type,storage_path,status,visual_metadata,created_at").eq("is_generated_visual", true).contains("visual_metadata", { jobId: input.jobId }).order("created_at", { ascending: false }).limit(120);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "NIU could not load generated visual drafts." });
    const ids = (items ?? []).map(item => item.id);
    const { data: versions } = ids.length ? await supabase.from("ai_visual_asset_versions").select("id,content_item_id,lesson_id,module_id,programme_id,title,caption,alt_text,accessibility_description,educational_purpose,generation_prompt,generation_model,version,review_status,reviewed_by,created_at").in("content_item_id", ids).order("version", { ascending: false }).limit(240) : { data: [] };
    return { items: items ?? [], versions: versions ?? [] };
  }),
  regenerateVisualAsset: publicProcedure.input(z.object({ versionId: z.string().uuid(), promptAdjustment: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: current, error: currentError } = await supabase.from("ai_visual_asset_versions").select("id,content_item_id,lesson_id,module_id,programme_id,title,caption,alt_text,accessibility_description,educational_purpose,generation_prompt,generation_model,generation_attempts,version,review_status").eq("id", input.versionId).maybeSingle();
    if (currentError || !current) throw new TRPCError({ code: "NOT_FOUND", message: "The visual version is not available for regeneration." });
    if (["published", "archived"].includes(current.review_status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Published or archived visual versions cannot be regenerated." });
    if ((current.generation_attempts ?? 0) >= 3) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This visual has reached the maximum of three generation attempts. Edit the specification or create a new governed draft." });
    const prompt = `${current.generation_prompt} Revised draft request: ${input.promptAdjustment || "Improve clarity while preserving the verified educational concept, labels, and accessibility intent."} Do not invent facts. Return a learning-support visual, not decorative media.`;
    let image;
    try {
      image = await generateImage({ prompt, model: current.generation_model || "MODEL_GPT_IMAGE_2", quality: "medium" });
    } catch (error) {
      const safeError = error instanceof Error ? error.message.slice(0, 500) : "Unknown provider error";
      await supabase.from("ai_visual_asset_versions").update({ generation_attempts: (current.generation_attempts ?? 0) + 1, last_generation_error: safeError }).eq("id", current.id);
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Visual regeneration failed. The provider error was recorded; retry remains bounded." });
    }
    if (!image.key || !image.url) throw new TRPCError({ code: "BAD_GATEWAY", message: "Visual regeneration returned no stored image." });
    const metadata = { regeneratedFromVersionId: current.id, storageKey: image.key, storageUrl: image.url, generatedBy: userId, generatedAt: new Date().toISOString(), generationPrompt: prompt };
    const { data: item, error: itemError } = await supabase.from("content_library_items").insert({ title: current.title, category: "image", file_name: `${current.lesson_id}-ai-visual-v${current.version + 1}.png`, content_type: image.mimeType ?? "image/png", storage_path: image.key, description: current.educational_purpose, status: "draft", governed_workflow: true, is_generated_visual: true, visual_metadata: metadata, created_by: userId }).select("id").single();
    if (itemError || !item) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: itemError?.message ?? "The regenerated visual draft could not be registered." });
    const { error: linkError } = await supabase.from("lesson_content_items").insert({ lesson_id: current.lesson_id, content_item_id: item.id, position: 999, is_required: false });
    if (linkError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: linkError.message });
    const { data: version, error: versionError } = await supabase.from("ai_visual_asset_versions").insert({ content_item_id: item.id, lesson_id: current.lesson_id, module_id: current.module_id, programme_id: current.programme_id, title: current.title, caption: current.caption, alt_text: current.alt_text, accessibility_description: current.accessibility_description, educational_purpose: current.educational_purpose, generation_model: current.generation_model || "MODEL_GPT_IMAGE_2", generation_prompt: prompt, generation_attempts: (current.generation_attempts ?? 0) + 1, version: current.version + 1, change_summary: `Regenerated from visual version ${current.version}`, review_status: "draft", created_by: userId }).select("id,review_status,version").single();
    if (versionError || !version) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: versionError?.message ?? "The regenerated visual version could not be created." });
    return { contentItemId: item.id, visualVersionId: version.id, version: version.version, status: version.review_status };
  }),
  removeVisualDraft: publicProcedure.input(z.object({ contentItemId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data: item, error: itemError } = await supabase.from("content_library_items").select("id,status,is_generated_visual").eq("id", input.contentItemId).maybeSingle();
    if (itemError || !item || !item.is_generated_visual) throw new TRPCError({ code: "NOT_FOUND", message: "Only generated visual drafts can be removed here." });
    if (["published", "archived"].includes(item.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Published or archived visuals cannot be removed." });
    const { error } = await supabase.from("content_library_items").delete().eq("id", input.contentItemId).eq("is_generated_visual", true).in("status", ["draft", "review"]);
    if (error) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The visual draft could not be removed." });
    return { removed: true, contentItemId: input.contentItemId };
  }),
  updateVisualAssetVersion: publicProcedure.input(z.object({ versionId: z.string().uuid(), caption: z.string().trim().min(3).max(1000).optional(), altText: z.string().trim().min(3).max(1000).optional(), accessibilityDescription: z.string().trim().min(3).max(4000).optional(), educationalPurpose: z.string().trim().min(3).max(2000).optional(), reviewStatus: z.enum(["draft", "review", "approved"]).optional() })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: current, error: currentError } = await supabase.from("ai_visual_asset_versions").select("id,review_status").eq("id", input.versionId).maybeSingle();
    if (currentError || !current) throw new TRPCError({ code: "NOT_FOUND", message: "The visual version is not available." });
    if (["published", "archived"].includes(current.review_status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Published or archived visual versions are immutable." });
    const patch = { ...(input.caption ? { caption: input.caption } : {}), ...(input.altText ? { alt_text: input.altText } : {}), ...(input.accessibilityDescription ? { accessibility_description: input.accessibilityDescription } : {}), ...(input.educationalPurpose ? { educational_purpose: input.educationalPurpose } : {}), ...(input.reviewStatus ? { review_status: input.reviewStatus } : {}), reviewed_by: input.reviewStatus === "approved" ? userId : null };
    const { data, error } = await supabase.from("ai_visual_asset_versions").update(patch).eq("id", input.versionId).in("review_status", ["draft", "review"]).select("id,review_status,caption,alt_text,accessibility_description,educational_purpose,reviewed_by").single();
    if (error || !data) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error?.message ?? "The visual version could not be updated. Check its current governed status." });
    return data;
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
    const { error: jobUpdateError } = await supabase.from("ai_academic_builder_jobs").update({ status: "ready_for_review", draft_artifact: { importId: inserted.id, storagePath: uploaded.key }, generated_at: new Date().toISOString(), generated_by: userId }).eq("id", job.id).in("status", ["generation_review", "ready_for_review"]);
    if (jobUpdateError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: jobUpdateError.message });
    return { jobId: job.id, importId: inserted.id, status: "ready_for_review" as const };
  }),
  generateCompletePackage: publicProcedure.input(z.object({ jobId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,blueprint,content_plan,visual_plan,assessment_blueprint,research_evidence,research_notes,generated_record_ids").eq("id", input.jobId).in("status", ["generation_review", "ready_for_review"]).maybeSingle();
    if (error || !job) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete package generation requires a reviewed AI Builder job." });
    if (job.generated_record_ids && Object.keys(job.generated_record_ids).length) throw new TRPCError({ code: "CONFLICT", message: "This AI Builder job already has a generated draft package." });
    const blueprint = job.blueprint as Blueprint | null;
    if (!blueprint?.programme || !blueprint.courses?.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A complete package requires a saved programme blueprint and at least one course." });
    if (!Array.isArray(job.research_evidence) || job.research_evidence.length < 1 || String(job.research_notes ?? "").trim().length < 20) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete package generation requires administrator research review and source evidence first." });
    const storagePaths: Array<{ fileName: string; storagePath: string }> = [];
    let materialIndex = 0;
    for (const course of blueprint.courses) for (const module of course.modules) for (const lesson of module.lessons) {
      const fileName = `ai-builder-${job.id}-${materialIndex}.md`;
      const body = `# Draft study guide: ${lesson.title}\\n\\nStatus: private NIU AI Builder draft.\\n\\nThis material is a structured authoring draft for administrator review. It makes no factual claim without verified source evidence.\\n\\n## Learning objectives\\n${lesson.objectives.map(item => `- ${item}`).join("\\n")}\\n\\n## Activities to author\\n${lesson.activityIdeas.map(item => `- ${item}`).join("\\n") || "- Administrator must author an activity."}\\n\\n## Evidence boundary\\nAdministrator must attach and verify authoritative sources before approval.`;
      const uploaded = await storagePut(`ai-builder/${job.id}/materials/${fileName}`, body, "text/markdown");
      storagePaths.push({ fileName, storagePath: uploaded.key });
      materialIndex += 1;
    }
    const packagePayload = compileCompleteDraftPackage(job.topic, blueprint, { contentPlan: job.content_plan, assessmentBlueprint: job.assessment_blueprint }, storagePaths);
    const { data: created, error: rpcError } = await supabase.rpc("niu_create_ai_draft_package", { p_job_id: input.jobId, p_package: packagePayload });
    if (rpcError || !created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: rpcError?.message ?? "The governed draft-package generator could not create its private records." });
    return { jobId: input.jobId, status: "ready_for_review" as const, generated: created, createdBy: userId };
  }),
  runQualityGate: publicProcedure.input(z.object({ jobId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data: job, error } = await supabase.from("ai_academic_builder_jobs").select("id,status,blueprint,content_plan,visual_plan,research_evidence,generated_record_ids").eq("id", input.jobId).maybeSingle();
    const ids = job?.generated_record_ids as { programId?: string; departmentId?: string; courses?: Array<{ courseId: string }> } | null;
    if (error || !job || !ids?.programId || !ids.courses?.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Quality gate is available after a complete private draft package has been generated." });
    const courseIds = ids.courses.map(course => course.courseId);
    const { data: links } = await supabase.from("program_courses").select("course_id").eq("program_id", ids.programId).in("course_id", courseIds);
    const { data: courseRows } = await supabase.from("courses").select("id,title,status,governed_workflow").in("id", courseIds);
    const { data: modules } = await supabase.from("course_modules").select("id,course_id,status,governed_workflow").in("course_id", courseIds);
    const moduleIds = (modules ?? []).map((module: any) => module.id);
    const { data: lessons } = moduleIds.length ? await supabase.from("lessons").select("id,module_id,status,governed_workflow,content_json,learning_objectives").in("module_id", moduleIds) : { data: [] };
    const lessonIds = (lessons ?? []).map((lesson: any) => lesson.id);
    const { data: materials } = lessonIds.length ? await supabase.from("lesson_content_items").select("lesson_id,content_item_id").in("lesson_id", lessonIds) : { data: [] };
    const { data: assessments } = await supabase.from("assessments").select("id,course_id,status").in("course_id", courseIds);
    const assessmentIds = (assessments ?? []).map((assessment: any) => assessment.id);
    const { data: assessmentQuestions } = assessmentIds.length ? await supabase.from("assessment_questions").select("assessment_id,question_id").in("assessment_id", assessmentIds) : { data: [] };
    const courseTitles = (courseRows ?? []).map((row: any) => String(row.title ?? "").trim().toLowerCase()).filter(Boolean);
    const evidenceRecords = Array.isArray(job.research_evidence) ? job.research_evidence : Object.values(job.research_evidence ?? {});
    const checks = [
      { key: "source-provenance", label: "Source provenance is recorded", passed: evidenceRecords.length > 0 },
      { key: "curriculum-completeness", label: "Curriculum has courses, modules, lessons, and objectives", passed: courseIds.length > 0 && moduleIds.length > 0 && lessonIds.length > 0 && (lessons ?? []).every((row: any) => Array.isArray(row.learning_objectives) && row.learning_objectives.length > 0) },
      { key: "duplicate-content", label: "Course titles contain no duplicates", passed: new Set(courseTitles).size === courseTitles.length },
      { key: "visual-plan", label: "Visual requirements are explicitly planned", passed: Array.isArray(job.visual_plan) },
      { key: "accessibility", label: "Accessibility metadata is present", passed: lessonIds.length > 0 && (lessons ?? []).every((row: any) => Array.isArray(row.content_json?.accessibility) && row.content_json.accessibility.length > 0) },
      { key: "programme-course-links", label: "Programme/course relationships", passed: (links ?? []).length === courseIds.length },
      { key: "courses-draft", label: "Courses remain draft", passed: (courseRows ?? []).length === courseIds.length && (courseRows ?? []).every((row: any) => row.status === "draft" && row.governed_workflow) },
      { key: "modules-draft", label: "Ordered modules remain draft", passed: moduleIds.length > 0 && (modules ?? []).every((row: any) => row.status === "draft" && row.governed_workflow) },
      { key: "lessons-draft", label: "Lessons remain draft", passed: lessonIds.length > 0 && (lessons ?? []).every((row: any) => row.status === "draft" && row.governed_workflow) },
      { key: "protected-material-links", label: "Protected material links exist", passed: materials?.length === lessonIds.length && lessonIds.length > 0 },
      { key: "assessments-draft", label: "Assessments and question mappings exist as drafts", passed: (assessments ?? []).length > 0 && (assessments ?? []).every((row: any) => row.status === "draft") && (assessmentQuestions ?? []).length > 0 },
      { key: "certificate-configuration", label: "Certificate configuration remains reviewable", passed: Boolean((job.blueprint as any)?.programme?.certificateSettings || (job.blueprint as any)?.certificateSettings || (job.content_plan as any)?.certificateSettings) },
      { key: "publication-boundary", label: "Publication boundary remains closed", passed: ["ready_for_review", "generation_review"].includes(job.status) },
    ];
    return { jobId: input.jobId, checks, passed: checks.every(check => check.passed), generated: { courses: courseIds.length, modules: moduleIds.length, lessons: lessonIds.length, materials: materials?.length ?? 0, assessments: assessments?.length ?? 0, questions: assessmentQuestions?.length ?? 0 } };
  }),
  learnerPreview: publicProcedure.input(z.object({ jobId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data: job, error } = await supabase.from("ai_academic_builder_jobs").select("id,status,generated_record_ids").eq("id", input.jobId).maybeSingle();
    const ids = job?.generated_record_ids as { courses?: Array<{ courseId: string }> } | null;
    if (error || !job || !ids?.courses?.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Learner preview is available after a complete private draft package has been generated." });
    const courseIds = ids.courses.map(course => course.courseId);
    const { data: courseRows } = await supabase.from("courses").select("id,title,description,level,duration_minutes,learning_objectives,requirements,status").in("id", courseIds);
    const { data: modules } = await supabase.from("course_modules").select("id,course_id,title,description,position,learning_level,learning_objectives,estimated_minutes,status").in("course_id", courseIds).order("position");
    const moduleIds = (modules ?? []).map((module: any) => module.id);
    const { data: lessons } = moduleIds.length ? await supabase.from("lessons").select("id,module_id,kind,title,description,position,estimated_minutes,points,status").in("module_id", moduleIds).order("position") : { data: [] };
    return { jobId: input.jobId, status: job.status, courses: (courseRows ?? []).map((course: any) => ({ ...course, modules: (modules ?? []).filter((module: any) => module.course_id === course.id).map((module: any) => ({ ...module, lessons: (lessons ?? []).filter((lesson: any) => lesson.module_id === module.id) })) })) };
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
