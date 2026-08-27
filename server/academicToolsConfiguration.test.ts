import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("NIU academic tools configuration", () => {
  it("supports configurable assessment types, timing, attempts, scores, and assignment submission controls", () => {
    const page = fs.readFileSync(path.resolve(import.meta.dirname, "..", "client", "src", "pages", "AcademicTools.tsx"), "utf8");
    expect(page).toContain('value="knowledge_check"');
    expect(page).toContain('value="module_test"');
    expect(page).toContain('value="final_assessment"');
    expect(page).toContain('value="exam"');
    expect(page).toContain("time_limit_minutes");
    expect(page).toContain("submission_limit");
    expect(page).toContain("randomize_questions: true");
    const policy = fs.readFileSync(path.resolve(import.meta.dirname, "..", "client", "src", "pages", "AssignmentPolicies.tsx"), "utf8");
    expect(policy).toContain("late_submission_policy");
    expect(policy).toContain("accept_with_penalty");
    expect(policy).toContain("reject_after_grace");
  });
});
