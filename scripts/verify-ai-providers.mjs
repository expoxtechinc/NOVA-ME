const topic = "Digital Marketing";
const settings = {
  difficulty: "intermediate",
  learningHours: 36,
  academicDepth: "applied",
  numberOfCourses: 3,
  targetLearner: "Beginners entering digital marketing roles",
  researchDepth: "standard",
  visualGeneration: true,
  assessmentGeneration: true,
};

const safeError = async (response) => {
  const text = await response.text().catch(() => "");
  return `${response.status} ${response.statusText}: ${text.replace(/(api[_-]?key|authorization|bearer)\\s*[:=]\\s*\\S+/gi, "$1=[REDACTED]").slice(0, 220)}`;
};

const openAiModel = process.env.OPENAI_MODEL || "gpt-5-mini";
const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
  body: JSON.stringify({
    model: openAiModel,
    messages: [
      { role: "system", content: "Return only JSON with keys provider, topic, difficulty, and courseCount. Do not add claims." },
      { role: "user", content: JSON.stringify({ topic, settings }) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 300,
  }),
});
if (!openAiResponse.ok) {
  console.log(JSON.stringify({ provider: "openai", model: openAiModel, ok: false, error: "AI provider request failed.", upstream: await safeError(openAiResponse) }));
} else {
  const openAiBody = await openAiResponse.json();
  const openAiContent = openAiBody.choices?.[0]?.message?.content;
  const openAiValue = typeof openAiContent === "string" ? JSON.parse(openAiContent) : null;
  console.log(JSON.stringify({ provider: "openai", model: openAiBody.model || openAiModel, ok: Boolean(openAiValue), topic: openAiValue?.topic, courseCount: openAiValue?.courseCount }));
}

let geminiModel = process.env.GEMINI_MODEL || "";
if (!geminiModel) {
  const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`);
  if (!modelsResponse.ok) {
    console.log(JSON.stringify({ provider: "gemini", ok: false, error: "AI provider request failed.", upstream: await safeError(modelsResponse) }));
    process.exitCode = 1;
  } else {
    const modelsBody = await modelsResponse.json();
    const available = (modelsBody.models || []).filter(model => (model.supportedGenerationMethods || []).includes("generateContent")).map(model => String(model.name || "").replace("models/", ""));
    geminiModel = available.find(model => /gemini-3\\.6-flash/i.test(model)) || available.find(model => /gemini-3/i.test(model)) || available.find(model => /gemini/i.test(model)) || "";
  }
}
if (!geminiModel) process.exit(1);
const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: `Return only JSON with keys provider, topic, and sourcePlan. Do not add claims. Context: ${JSON.stringify({ topic, settings })}` }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  }),
});
if (!geminiResponse.ok) {
  console.log(JSON.stringify({ provider: "gemini", model: geminiModel, ok: false, error: "AI provider request failed.", upstream: await safeError(geminiResponse) }));
} else {
  const geminiBody = await geminiResponse.json();
  const geminiContent = geminiBody.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
  const geminiValue = typeof geminiContent === "string" ? JSON.parse(geminiContent) : null;
  console.log(JSON.stringify({ provider: "gemini", model: geminiModel, ok: Boolean(geminiValue), topic: geminiValue?.topic }));
}
