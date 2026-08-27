import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU Course Studio", () => {
  it("is routed as the unified academic-authoring workspace", () => {
    const app = fs.readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8");
    const dashboard = fs.readFileSync(path.join(root, "client", "src", "pages", "AdminDashboard.tsx"), "utf8");
    expect(app).toContain('const CourseStudio = lazy(() => import("./pages/CourseStudio"));');
    expect(app).toContain('<Route path="/course-studio" component={CourseStudio} />');
    expect(dashboard).toContain('["Course Studio — create programme", "/course-studio"]');
  });

  it("keeps the Course Studio workspace staff-only and certificate-only", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(studio).toContain('const staff = role === "instructor" || role === "administrator" || role === "super_admin"');
    expect(studio).toContain('if (!staff) return <SiteShell>');
    expect(studio).toContain('award_type: "certificate"');
    expect(studio).toContain('status: "draft"');
    expect(studio).toContain('created_by: userId');
    expect(studio).toContain("Final publishing remains reviewer-authorised and certificate-only.");
  });

  it("creates real programme, course, module, and lesson relationships without page redirects", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(studio).toContain('from("certificate_programs").insert');
    expect(studio).toContain('from("courses").insert');
    expect(studio).toContain('from("course_versions").insert');
    expect(studio).toContain('from("program_courses").insert');
    expect(studio).toContain('from("course_modules").insert');
    expect(studio).toContain('from("lessons").insert');
    expect(studio).toContain('setStep("curriculum")');
    expect(studio).toContain('setStep("lesson")');
    expect(studio).not.toContain('window.location');
  });

  it("keeps automatic completion eligibility separate from administrator issuance", () => {
    const migration = fs.readFileSync(path.join(root, "docs/supabase/20260827_niu_admin_controlled_certificate_eligibility.sql"), "utf8");
    expect(migration).toContain("'administrator_approval_required', true");
    expect(migration).toContain("'eligible'");
    expect(migration).not.toContain("insert into public.certificates");
    const executionRestriction = fs.readFileSync(path.join(root, "docs/supabase/20260827_niu_restrict_automatic_eligibility_execution.sql"), "utf8");
    expect(executionRestriction).toContain("revoke all on function public.niu_auto_issue_certificate_for_program_enrollment(uuid) from public");
    const roleRestriction = fs.readFileSync(path.join(root, "docs/supabase/20260827_niu_revoke_internal_eligibility_roles.sql"), "utf8");
    expect(roleRestriction).toContain("revoke execute on function public.niu_course_enrollment_eligibility_trigger() from anon, authenticated");
    expect(roleRestriction).toContain("revoke execute on function public.niu_grade_release_eligibility_trigger() from anon, authenticated");
    expect(roleRestriction).toContain("revoke execute on function public.niu_recalculate_certificate_candidate(uuid, uuid) from anon, authenticated");
    const workflow = fs.readFileSync(path.join(root, "docs/supabase/20260826_niu_credential_workflows.sql"), "utf8");
    const review = fs.readFileSync(path.join(root, "docs/supabase/20260827_niu_candidate_review_authorization.sql"), "utf8");
    const registrar = fs.readFileSync(path.join(root, "client", "src", "pages", "Registrar.tsx"), "utf8");
    expect(workflow).toContain("if auth.uid() is null or not public.niu_is_registrar()");
    expect(workflow).toContain("candidate.eligibility_status <> 'approved'");
    expect(review).toContain("certificate_candidate_reviewed");
    expect(review).toContain("grant execute on function public.niu_review_certificate_candidate");
    expect(registrar).toContain('supabase.rpc("niu_review_certificate_candidate"');
  });

  it("keeps supporting documents administrator-authored and learner-private", () => {
    const app = fs.readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8");
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "SupportingDocuments.tsx"), "utf8");
    const migration = fs.readFileSync(path.join(root, "docs/supabase/20260827_niu_supporting_documents.sql"), "utf8");
    expect(app).toContain('const SupportingDocuments = lazy(() => import("./pages/SupportingDocuments"));');
    expect(app).toContain('<Route path="/supporting-documents" component={SupportingDocuments} />');
    expect(page).toContain('supabase.rpc("niu_create_supporting_document"');
    expect(page).toContain('supabase.rpc("niu_issue_supporting_document"');
    expect(page).toContain('eq("status", "issued")');
    expect(migration).toContain("recommendation_letter");
    expect(migration).toContain("public.niu_is_registrar()");
    expect(migration).toContain("supporting_document_issued");
  });

  it("keeps learner certificate and transcript artifacts protected and lawfully labelled", () => {
    const credentials = fs.readFileSync(path.join(root, "client", "src", "pages", "Credentials.tsx"), "utf8");
    const certificate = fs.readFileSync(path.join(root, "client", "src", "pages", "CertificatePrint.tsx"), "utf8");
    const transcript = fs.readFileSync(path.join(root, "client", "src", "pages", "Transcript.tsx"), "utf8");
    expect(credentials).toContain('from("certificate_candidates")');
    expect(credentials).toContain("does not promise accreditation, government recognition, licensure, transfer credit, or universal acceptance");
    expect(certificate).toContain("Akin S. Sokpah — President and Founder");
    expect(certificate).toContain("akinssokpah");
    expect(transcript).toContain("does not represent a degree transcript or an accreditation claim");
  });

  it("keeps protected content, assessment, preview, and publication as governed Course Studio panels", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(studio).toContain('step === "content"');
    expect(studio).toContain('supabase.storage.from("niu-learning-materials").upload');
    expect(studio).toContain('from("content_library_items").insert');
    expect(studio).toContain('from("lesson_content_items").insert');
    expect(studio).toContain('setNotice("Private learning resource uploaded and attached to the selected lesson. Learners will receive it only through enrolled-course access.")');
    expect(studio).toContain('step === "assessment"');
    expect(studio).toContain('from("assessments").insert');
    expect(studio).toContain('assessment_type: assessmentForm.type');
    expect(studio).toContain('status: "draft"');
    expect(studio).toContain('async function saveProgrammeRules');
    expect(studio).toContain('completion_requirements: { ...existing');
    expect(studio).toContain('certificate_template_key: certificateForm.templateKey.trim()');
    expect(studio).toContain('step === "preview"');
    expect(studio).toContain('href: "/content-library"');
    expect(studio).toContain('href="/programme-publication"');
    expect(studio).toContain("Protected materials stay in private object storage.");
  });
});
