import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU governed Question Bank", () => {
  it("uses an additive migration with database-enforced approval and attachment controls", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_question_bank_governance.sql"), "utf8");
    expect(migration).toContain("add column if not exists topic text");
    expect(migration).toContain("add column if not exists learning_objective text");
    expect(migration).toContain("add column if not exists approval_status text not null default 'draft'");
    expect(migration).toContain("Only an administrator or registrar may approve a question");
    expect(migration).toContain("Only approved questions may be attached to an assessment");
    expect(migration).toContain("create trigger niu_audit_question_banks");
    expect(migration).toContain("create trigger niu_audit_questions");
    expect(migration).toContain("create trigger niu_audit_assessment_questions");
    expect(migration).not.toMatch(/insert\s+into\s+public\.(question_banks|questions|assessments)/i);
  });

  it("exposes the complete staff authoring and governance surface without demo content", () => {
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "AssessmentBuilder.tsx"), "utf8");
    for (const label of ["Create Question Bank", "Choose a bank", "Edit saved question", "Answer choices and correct answer", "Difficulty", "Topic", "Learning objective", "Points", "approval_status", "Attach saved question", "No approved questions are ready to attach"]) {
      expect(page).toContain(label);
    }
    expect(page).toContain('approval_status: "draft"');
    expect(page).toContain('question.approval_status === "approved"');
    expect(page).not.toContain("seed");
    expect(page).not.toContain("demo");
  });
});
