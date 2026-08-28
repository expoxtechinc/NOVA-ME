import { runStructuredAIWithFallback } from "../server/aiOrchestrator.ts";
import { blueprintSchema } from "../server/routers/aiBuilder.ts";

const result = await runStructuredAIWithFallback(
  {
    provider: "openai",
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    system: "You are NIU's curriculum architect. NIU offers certificate programmes only. Create a planning blueprint, not publishable academic records. Use only the topic and explicit settings. Do not invent references, research findings, accreditation, licensing, employment, or recognition claims. When evidence is needed, create a research plan and mark it as required before writing. Use only introductory, intermediate, or advanced difficulty. Return JSON matching the schema exactly.",
    prompt: "Programme topic: Digital Marketing\nSettings: {\"difficulty\":\"intermediate\",\"learningHours\":36,\"academicDepth\":\"applied\",\"numberOfCourses\":3,\"targetLearner\":\"Beginners entering digital marketing roles\",\"researchDepth\":\"standard\",\"visualGeneration\":true,\"assessmentGeneration\":true,\"referenceRequirements\":\"Standard source plan\"}\nDesign a coherent progression from foundation to assessment. Choose course/module/lesson counts based on subject complexity. Mark missing information rather than guessing. Keep all generated content clearly a draft blueprint for administrator review.",
    schema: blueprintSchema,
  },
  "gemini",
);

const blueprint = result.value;
console.log(JSON.stringify({
  provider: result.provider,
  model: result.model,
  success: Boolean(blueprint?.programme && Array.isArray(blueprint?.courses) && Array.isArray(blueprint?.researchPlan)),
  programmeTitle: blueprint?.programme?.title,
  courseCount: blueprint?.courses?.length,
  researchPlanCount: blueprint?.researchPlan?.length,
  hasMissingInformation: Array.isArray(blueprint?.missingInformation),
}));
