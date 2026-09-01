import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "docs", "supabase", "20260903_niu_learner_assessment_engine.sql"),
  "utf8",
);

describe("NIU learner assessment engine migration", () => {
  it("adds only nullable attempt metadata and preserves legacy rows", () => {
    for (const column of [
      "assessment_id uuid",
      "enrollment_id uuid",
      "attempt_number integer",
      "started_at timestamptz",
      "percentage numeric(5,2)",
      "status text",
    ]) {
      expect(migration).toContain(`add column if not exists ${column}`);
    }
    const schemaOnly = migration.slice(0, migration.indexOf("drop function if exists public.niu_start_assessment"));
    expect(schemaOnly).not.toMatch(/update\s+public\.assessment_attempts/i);
    expect(schemaOnly).not.toMatch(/delete\s+from\s+public\.(assessments|questions|enrollments|assessment_attempts)/i);
    expect(migration).toContain("assessment_attempts_assessment_user_attempt_unique");
    expect(migration).toContain("assessment_attempts_attempt_number_positive");
    expect(migration).toContain("assessment_attempts_percentage_range");
    expect(migration).toContain("assessment_attempts_status_allowed");
  });

  it("exposes enrollment-bound SECURITY DEFINER start and submit RPCs", () => {
    expect(migration).toMatch(/create or replace function public\.niu_start_assessment\(\s*target_assessment_id uuid,\s*target_enrollment_id uuid/s);
    expect(migration).toMatch(/create or replace function public\.niu_submit_assessment\(\s*target_attempt_id uuid,\s*target_answers jsonb/s);
    expect(migration.match(/security definer/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("status in ('approved', 'published')");
    expect(migration).toContain("user_id = actor");
    expect(migration).toContain("course_id = target_assessment.course_id");
    expect(migration).toContain("status = 'active'::public.enrollment_status");
    expect(migration).toContain("status in ('active'::public.enrollment_status, 'completed'::public.enrollment_status)");
    expect(migration).toContain("public.niu_get_assessment_for_learner");
    expect(migration).toContain("grant execute on function public.niu_get_assessment_for_learner(uuid,uuid) to authenticated");
    expect(migration).toContain("'questions'");
    expect(migration).not.toContain("'answer_key', q.answer_key");
  });

  it("enforces limits atomically and prevents direct learner status writes", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("used_attempts >= target_assessment.attempt_limit");
    expect(migration).toContain("revoke insert, update, delete on public.assessment_attempts from public, anon, authenticated");
    expect(migration).toContain("assessment_attempts_no_direct_update");
    expect(migration).toContain("grant execute on function public.niu_start_assessment(uuid, uuid) to authenticated");
    expect(migration).toContain("grant execute on function public.niu_submit_assessment(uuid, jsonb) to authenticated");
    expect(migration).toContain("status = 'submitted'");
    expect(migration).toContain("set answers = target_answers");
    expect(migration).toContain("passed = calculated_percentage >= target_assessment.passing_score");
  });
});
