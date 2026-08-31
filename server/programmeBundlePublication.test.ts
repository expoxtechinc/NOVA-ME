import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = path.resolve(import.meta.dirname, "..");
describe("NIU controlled programme bundle publication", () => {
  it("requires authorised database-side readiness checks before publication", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_programme_bundle_publication.sql"), "utf8");
    expect(migration).toContain("niu_programme_bundle_readiness");
    expect(migration).toContain("niu_is_academic_staff()");
    expect(migration).toContain("required_lessons_with_material");
    expect(migration).toContain("niu_publish_programme_bundle");
    expect(migration).toContain("niu_is_administrator()");
    expect(migration).toContain("certificate programme must be approved");
    expect(migration).toContain("programme_bundle_published");
    expect(migration).toContain("revoke all");
    const publication = fs.readFileSync(path.join(root, "client", "src", "pages", "ProgrammePublication.tsx"), "utf8");
    expect(publication).toContain('rpc("niu_programme_bundle_readiness"');
    expect(publication).toContain('rpc("niu_publish_programme_bundle"');
    expect(publication).toContain("Publish complete bundle");
  });

  it("keeps the production readiness repair aligned with the live attachment table and PostgreSQL JSONB support", () => {
    const repair = fs.readFileSync(path.join(root, "docs", "supabase", "20260829_fix_niu_programme_bundle_readiness_jsonb_predicate.sql"), "utf8");
    expect(repair).toContain("left join public.lesson_content_items li");
    expect(repair).not.toContain("lesson_content_library_items");
    expect(repair).not.toContain("jsonb_object_length");
    expect(repair).toContain("from jsonb_each(coalesce(a.required_completion_rules, '{}'::jsonb))");
  });

  it("keeps enrollment limited to active accounts and published courses while using the live enrollment-status enum", () => {
    const enrollmentRepair = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_enrollment_status_enum_repair.sql"), "utf8");
    expect(enrollmentRepair).toContain("public.niu_account_is_active()");
    expect(enrollmentRepair).toContain("status = 'published'");
    expect(enrollmentRepair).toContain("'active'::public.enrollment_status");
    expect(enrollmentRepair).toContain("'completed'::public.enrollment_status");
    expect(enrollmentRepair).toContain("revoke all on function public.niu_enroll_in_course(uuid) from public, anon");
  });

  it("ships a final relationship-authoritative readiness repair", () => {
    const repair = fs.readFileSync(path.join(root, "docs", "supabase", "20260904_niu_pmf_readiness_consistency.sql"), "utf8");
    expect(repair).toContain("public.program_modules");
    expect(repair).toContain("public.program_lessons");
    expect(repair).toContain("from jsonb_each");
    expect(repair).not.toContain("jsonb_object_length");
    expect(repair).toContain("missing_requirements");
    expect(repair).toContain("approved protected material");
  });

  it("keeps question approval and lesson archival governed", () => {
    const governance = fs.readFileSync(path.join(root, "docs", "supabase", "20260905_niu_question_and_lesson_governance.sql"), "utf8");
    expect(governance).toContain("target_type not in ('course','module','lesson','assessment','certificate_template','question')");
    expect(governance).toContain("target_status='approved' and current_status <> 'review'");
    expect(governance).toContain("public.niu_archive_academic_record");
    expect(governance).toContain("status='archived'");
    const builder = fs.readFileSync(path.join(root, "client", "src", "pages", "AssessmentBuilder.tsx"), "utf8");
    expect(builder).toContain('rpc("niu_transition_academic_record"');
  });
});
