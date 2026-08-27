import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_future_academic_governance.sql"), "utf8");
const programmeMigration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_future_programme_governance.sql"), "utf8");
const readinessMigration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_future_governance_programme_readiness.sql"), "utf8");
const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
const academicTools = fs.readFileSync(path.join(root, "client", "src", "pages", "AcademicTools.tsx"), "utf8");
const contentLibrary = fs.readFileSync(path.join(root, "client", "src", "pages", "ContentLibrary.tsx"), "utf8");
const questionBank = fs.readFileSync(path.join(root, "client", "src", "pages", "AssessmentBuilder.tsx"), "utf8");

describe("future academic governance", () => {
  it("uses additive opt-in flags and the full lifecycle without seeding records", () => {
    expect(migration).toContain("governed_workflow boolean not null default false");
    expect(migration).toContain("status in ('draft', 'review', 'approved', 'published', 'archived')");
    expect(migration).toContain("New governed content must start as Draft");
    expect(migration).toContain("Published content cannot be returned to Draft");
    expect(migration).toContain("revoke all on function public.niu_validate_future_assessment()");
    expect(migration).not.toMatch(/insert\s+into\s+public\.(questions|assessments|question_banks|courses|course_modules|lessons|content_library_items)/i);
  });

  it("validates assessment publication prerequisites and blocks unready bundles", () => {
    expect(migration).toContain("Assessment publication requires a positive time limit in minutes");
    expect(migration).toContain("Assessment publication requires a positive attempt limit");
    expect(migration).toContain("Assessment publication requires saved completion rules");
    expect(migration).toContain("Assessment publication requires at least one approved question");
    expect(migration).toContain("Assessment publication is blocked while attached questions are not approved");
    expect(migration).toContain("niu_future_assessment_title_key");
    expect(readinessMigration).toContain("ready_governed_assessments");
    expect(readinessMigration).toContain("governed_assessments");
  });

  it("validates question answer keys, points, metadata, and governed transitions", () => {
    expect(migration).toContain("Question points must be greater than zero");
    expect(migration).toContain("Multiple-choice questions require at least two choices");
    expect(migration).toContain("Multiple-choice questions require a valid correct answer");
    expect(migration).toContain("Question review requires a topic");
    expect(migration).toContain("Question review requires a learning-objective mapping");
    expect(migration).toContain("Draft questions must enter Review before approval");
    expect(migration).toContain("Administrator authorization is required for question approval");
    expect(migration).toContain("Only approved or published questions may be attached to an assessment");
  });

  it("keeps every future Course Studio authoring path draft-first and governed", () => {
    for (const source of [studio, academicTools, contentLibrary, questionBank]) expect(source).toContain("governed_workflow: true");
    expect(studio).toContain('status: "draft"');
    expect(studio).toContain("required_completion_rules");
    expect(studio).toContain("A non-archived assessment named");
    expect(studio).toContain("Saving never publishes or approves an assessment");
    expect(academicTools).toContain("required_completion_rules");
  });

  it("adds governed certificate-template storage and audit coverage without creating templates", () => {
    expect(migration).toContain("create table if not exists public.certificate_templates");
    expect(migration).toContain("unique (template_key)");
    expect(migration).toContain("niu_audit_certificate_templates");
    expect(programmeMigration).toContain("governed_workflow boolean not null default false");
  });
});
