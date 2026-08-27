import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { analyzeCurriculumDocument } from "../shared/curriculumImport";

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "client", "src", "pages", "CurriculumImport.tsx"), "utf8");
const packagePage = fs.readFileSync(path.join(root, "client", "src", "pages", "ProgrammePackage.tsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_curriculum_imports.sql"), "utf8");

describe("Curriculum Import", () => {
  it("extracts only explicit curriculum structure in source order", () => {
    const result = analyzeCurriculumDocument(`# Department: Digital Learning\n# Programme: Certificate in Remote Work\nDescription: This is an explicit certificate programme description for responsible remote work.\n## Course: Digital Foundations\nDescription: An explicit course description.\n### Module 1: Digital confidence\nDifficulty: introductory\n#### Lesson 1: Safe access\nObjective: Identify safe access practices.\nActivity: Guided checklist\nAssessment: Access knowledge check\nQuestion: Which practice protects an account?\n### Module 2: Collaboration\nDifficulty: intermediate\n#### Lesson 2: Team planning\nObjective: Plan shared work.\nActivity: Team plan`, "curriculum.md");
    expect(result.courses[0]?.modules.map(item => item.title)).toEqual(["Digital confidence", "Collaboration"]);
    expect(result.courses[0]?.modules[0]?.lessons[0]?.title).toBe("Safe access");
    expect(result.courses[0]?.modules[0]?.lessons[0]?.knowledgeChecks).toEqual(["Which practice protects an account?"]);
    expect(result.courses[0]?.modules[1]?.lessons[0]?.title).toBe("Team planning");
  });

  it("marks missing information and rejects unsupported difficulty without inventing content", () => {
    const result = analyzeCurriculumDocument("# Programme: Incomplete programme\n## Course: Incomplete course\n### Module 1: Unspecified level", "curriculum.txt");
    expect(result.missingInformation).toContain("Department name and school relationship are missing.");
    expect(result.missingInformation.some(item => item.includes("needs introductory, intermediate, or advanced difficulty"))).toBe(true);
    expect(result.missingInformation.some(item => item.includes("has no lessons"))).toBe(true);
    expect(result.courses[0]?.modules[0]?.lessons).toHaveLength(0);
    expect(result.validationErrors).toHaveLength(0);
  });

  it("enforces the private upload, draft-only, no-guessing, and guided-package contract", () => {
    expect(migration).toContain("create table if not exists public.curriculum_imports");
    expect(migration).toContain("source_storage_path text not null unique");
    expect(migration).toContain("status text not null default 'uploaded'");
    expect(migration).toContain("niu_capture_audit_event");
    expect(page).toContain("Import Complete Curriculum");
    expect(page).toContain("Generate private draft package");
    expect(page).toContain("never publishes or approves generated content");
    expect(page).toContain("NIU will not invent missing academic information");
    expect(page).toContain("Duplicate course titles were detected");
    expect(page).toContain("Duplicate module titles were detected within a course");
    expect(page).toContain('status: "draft"');
    expect(page).toContain('governed_workflow: true');
    expect(page).toContain("niu-learning-materials");
    expect(packagePage).toContain('href="/curriculum-import"');
    expect(packagePage).toContain("Import Complete Curriculum");
  });
});
