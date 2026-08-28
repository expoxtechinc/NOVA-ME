import { ENV } from "./_core/env";

export type AIProvider = "openai" | "gemini";

export type OrchestrationRequest = {
  provider: AIProvider;
  system: string;
  prompt: string;
  schema?: Record<string, unknown>;
  model?: string;
  temperature?: number;
};

export type OrchestrationResult<T> = {
  provider: AIProvider;
  model: string;
  value: T;
};

const providerKey = (provider: AIProvider) => provider === "openai" ? ENV.openAiApiKey : ENV.geminiApiKey;

const ensureProviderKey = (provider: AIProvider) => {
  if (!providerKey(provider)) throw new Error(`${provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY"} is not configured for server-side AI orchestration.`);
};

const parseJson = <T>(content: string): T => {
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("The AI provider returned malformed structured output.");
  }
};

const toGeminiSchema = (schema: Record<string, unknown>): Record<string, unknown> => {
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    if (key === "properties" && value && typeof value === "object") {
      converted[key] = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([name, child]) => [name, child && typeof child === "object" ? toGeminiSchema(child as Record<string, unknown>) : child]));
    } else if (key === "items" && value && typeof value === "object") {
      converted[key] = toGeminiSchema(value as Record<string, unknown>);
    } else {
      converted[key] = value;
    }
  }
  return converted;
};

const safeProviderError = async (response: Response, provider: AIProvider) => {
  const detail = await response.text().catch(() => "");
  let reason = "request failed";
  try {
    const parsed = JSON.parse(detail) as { error?: { message?: string }; message?: string };
    reason = parsed.error?.message ?? parsed.message ?? reason;
  } catch {
    if (detail) reason = detail.slice(0, 240);
  }
  return `${provider} AI request failed (${response.status}): ${reason}`;
};

export async function listProviderModels(provider: AIProvider): Promise<string[]> {
  ensureProviderKey(provider);
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${ENV.openAiApiKey}` } });
    if (!response.ok) throw new Error(await safeProviderError(response, provider));
    const body = await response.json() as { data?: Array<{ id?: string }> };
    return (body.data ?? []).map(item => item.id).filter((id): id is string => Boolean(id));
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(ENV.geminiApiKey)}`);
  if (!response.ok) throw new Error(await safeProviderError(response, provider));
  const body = await response.json() as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
  return (body.models ?? [])
    .filter(item => item.supportedGenerationMethods?.includes("generateContent"))
    .map(item => item.name?.replace(/^models\//, ""))
    .filter((id): id is string => Boolean(id));
}

const chooseModel = async (provider: AIProvider, requested?: string) => {
  if (requested) return requested;
  const configured = provider === "openai" ? ENV.openAiModel : ENV.geminiModel;
  if (provider === "openai" && configured) return configured;
  const models = await listProviderModels(provider);
  if (provider === "gemini" && configured && models.includes(configured)) return configured;
  const preferred = provider === "openai"
    ? models.find(model => /^gpt-/.test(model) && !model.includes("audio"))
    : models.find(model => /gemini-3\\.6-flash/i.test(model))
      ?? models.find(model => /gemini-3/i.test(model))
      ?? models.find(model => /gemini/i.test(model));
  if (!preferred) throw new Error(`No compatible ${provider} structured-output model is available.`);
  return preferred;
};

export async function runStructuredAI<T>(request: OrchestrationRequest): Promise<OrchestrationResult<T>> {
  ensureProviderKey(request.provider);
  const model = await chooseModel(request.provider, request.model);
  if (request.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.openAiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0.1,
        messages: [{ role: "system", content: request.system }, { role: "user", content: request.prompt }],
        ...(request.schema ? { response_format: { type: "json_schema", json_schema: { name: "niu_ai_output", strict: true, schema: request.schema } } } : {}),
      }),
    });
    if (!response.ok) throw new Error(await safeProviderError(response, request.provider));
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned no usable content.");
    return { provider: request.provider, model, value: request.schema ? parseJson<T>(content) : content as T };
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(ENV.geminiApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${request.system}\n\n${request.prompt}` }] }],
      generationConfig: { temperature: request.temperature ?? 0.1, ...(request.schema ? { responseMimeType: "application/json", responseSchema: toGeminiSchema(request.schema) } : {}) },
    }),
  });
  if (!response.ok) throw new Error(await safeProviderError(response, request.provider));
  const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = body.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("").trim();
  if (!content) throw new Error("Gemini returned no usable content.");
  return { provider: request.provider, model, value: request.schema ? parseJson<T>(content) : content as T };
}

export async function runStructuredAIWithFallback<T>(request: OrchestrationRequest, fallbackProvider?: AIProvider): Promise<OrchestrationResult<T>> {
  try {
    return await runStructuredAI(request);
  } catch (primaryError) {
    if (!fallbackProvider || fallbackProvider === request.provider) throw primaryError;
    console.warn(`AI provider ${request.provider} failed; attempting configured ${fallbackProvider} fallback.`);
    return runStructuredAI({ ...request, provider: fallbackProvider, model: undefined });
  }
}

export function providerConfigurationStatus() {
  return { openaiConfigured: Boolean(ENV.openAiApiKey), geminiConfigured: Boolean(ENV.geminiApiKey), serverOnly: true };
}
