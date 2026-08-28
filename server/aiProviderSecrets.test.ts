import { describe, expect, it } from "vitest";

describe("NIU AI provider secret boundary", () => {
  it("validates configured provider credentials through lightweight model endpoints", async () => {
    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    expect(openAiKey, "OPENAI_API_KEY must be configured server-side").toBeTruthy();
    expect(geminiKey, "GEMINI_API_KEY must be configured server-side").toBeTruthy();

    const [openAiResponse, geminiResponse] = await Promise.all([
      fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${openAiKey}` } }),
      fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(geminiKey ?? "")}`),
    ]);

    expect(openAiResponse.ok, `OpenAI model endpoint returned ${openAiResponse.status}`).toBe(true);
    expect(geminiResponse.ok, `Gemini model endpoint returned ${geminiResponse.status}`).toBe(true);
  }, 30_000);
});

// Do not print, snapshot, or include either credential in test output.
