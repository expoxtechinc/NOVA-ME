import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU Course Studio", () => {
  it("exposes the owner-provided contact controls with accessible destinations", () => {
    const shell = fs.readFileSync(path.join(root, "client", "src", "components", "SiteShell.tsx"), "utf8");
    expect(shell).toContain("https://wa.me/231760030163");
    expect(shell).toContain("aki.sokpah.link@gmail.com");
    expect(shell).toContain("https://www.facebook.com/share/1Dj6oYFsdv/");
    expect(shell).toContain("Contact NIU on WhatsApp at +231 760 030 163");
    expect(shell).toContain("Email NIU at aki.sokpah.link@gmail.com");
    expect(shell).toContain("Visit NIU on Facebook");
  });
  it("is routed as the unified academic-authoring workspace", () => {
    const app = fs.readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8");
    const dashboard = fs.readFileSync(path.join(root, "client", "src", "pages", "AdminDashboard.tsx"), "utf8");
    expect(app).toContain('const CourseStudio = lazy(() => import("./pages/CourseStudio"));');
    expect(app).toContain('<Route path="/programme-builder" component={CourseStudio} />');
    expect(app).toContain('<Route path="/course-studio" component={CourseStudio} />');
    expect(dashboard).toContain('["Programme Builder — create programme", "/programme-builder"]');
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

  it("keeps Step 2 course persistence isolated from programme state and selects the attached course", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(studio).toContain("type CourseFormState");
    expect(studio).toContain("buildCourseInsertPayload(courseForm, userId)");
    expect(studio).toContain('supabase.from("courses").insert(payload)');
    expect(studio).toContain('supabase.from("program_courses").insert({ program_id: programmeId, course_id: created.id');
    expect(studio).toContain('await loadStructure(programmeId); setCourseId(created.id)');
    expect(studio).toContain('setCourseForm({ title: "", description: "", category: "Professional development"');
    expect(studio).toContain('from("course_modules").insert({ course_id: courseId');
    expect(studio).not.toContain('supabase.from("certificate_programs").update({ title: courseForm');
    expect(studio).toContain("Programme information is read-only in Step 2");
  });

  it("restores only the affected PMF programme name without deleting history", () => {
    const migration = fs.readFileSync(path.join(root, "docs/supabase/20260831_restore_pmf_programme_name.sql"), "utf8");
    expect(migration).toContain("update public.certificate_programs");
    expect(migration).toContain("PMF-CAPM-101");
    expect(migration).toContain("Project Management Foundations: CAPM Preparation");
    expect(migration).not.toContain("delete from");
    expect(migration).not.toContain("objectives =");
    expect(migration).not.toContain("completion_requirements =");
  });

  it("provides scoped approval with audit events and short-programme readiness gates", () => {
    const migration = fs.readFileSync(path.join(root, "docs/supabase/20260901_niu_review_workflow.sql"), "utf8");
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(migration).toContain("niu_transition_academic_record");
    expect(migration).toContain("target_type not in ('course', 'module', 'lesson', 'assessment', 'certificate_template')");
    expect(migration).toContain("academic_record_status_changed");
    expect(migration).toContain("insert into public.audit_events");
    expect(migration).toContain("course_total = 1");
    expect(migration).toContain("module_total = 1");
    expect(migration).toContain("required_lesson_total = 1");
    expect(migration).toContain("required_material_total = 1");
    expect(migration).toContain("governed_assessment_total = 1");
    expect(studio).toContain('supabase.rpc("niu_transition_academic_record"');
    expect(studio).toContain("Governed workflow: Draft → Review → Approved. Each transition is audited.");
    expect(studio).toContain('readiness?.courses === 1');
    expect(studio).toContain('readiness?.modules === 1');
    expect(studio).toContain('readiness?.required_lessons === 1');
    expect(studio).toContain('readiness?.governed_assessments === 1');
  });

  it("supports scoped academic approval and the five-minute certificate gate thresholds", () => {
    const migration = fs.readFileSync(path.join(root, "docs/supabase/20260901_niu_review_workflow.sql"), "utf8");
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(migration).toContain("create or replace function public.niu_transition_academic_record");
    expect(migration).toContain("target_type not in ('course', 'module', 'lesson', 'assessment', 'certificate_template')");
    expect(migration).toContain("status = 'approved'");
    expect(migration).toContain("insert into public.audit_events");
    expect(migration).toContain("course_total = 1");
    expect(migration).toContain("module_total = 1");
    expect(migration).toContain("required_lesson_total = 1");
    expect(migration).toContain("required_material_total = 1");
    expect(migration).toContain("governed_assessment_total = 1");
    expect(migration).toContain("template_total = 1");
    expect(studio).toContain('supabase.rpc("niu_transition_academic_record"');
    expect(studio).toContain("Governed workflow: Draft → Review → Approved. Each transition is audited.");
    expect(studio).toContain('readiness?.courses === 1');
    expect(studio).toContain('readiness?.modules === 1');
    expect(studio).toContain('readiness?.required_lessons === 1');
    expect(studio).toContain('readiness?.governed_assessments === 1');
  });

  it("casts course transitions to the live enum without changing related text-backed statuses", () => {
    const migration = fs.readFileSync(path.join(root, "docs/supabase/20260901_niu_review_workflow.sql"), "utf8");
    expect(migration).toContain("public.course_status");
    expect(migration).toContain("(target_status)::public.course_status");
    expect(migration).toContain("courses.status is public.course_status");
    expect(migration).toContain("course_modules set status = target_status::text");
    expect(migration).toContain("lessons set status = target_status::text");
    expect(migration).toContain("assessments set status = target_status::text");
    expect(migration).toContain("certificate_templates set status = target_status::text");
    expect(migration).not.toContain("alter type public.course_status");
  });

  it("enforces Draft to Review to Approved governance across Programme Builder records", () => {
    const migration = fs.readFileSync(path.join(root, "docs/supabase/20260901_niu_review_workflow.sql"), "utf8");
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(migration).toContain("niu_transition_academic_record");
    expect(migration).toContain("target_status not in ('review', 'approved')");
    expect(migration).toContain("Draft content must enter Review before approval");
    expect(migration).toContain("course");
    expect(migration).toContain("module");
    expect(migration).toContain("lesson");
    expect(migration).toContain("assessment");
    expect(migration).toContain("certificate_template");
    expect(migration).toContain("insert into public.audit_events");
    expect(studio).toContain("Submit for Review");
    expect(studio).toContain("Approve ${label}");
    expect(studio).toContain("Approved");
    expect(studio).toContain('supabase.rpc("niu_transition_academic_record"');
  });

  it("hardens Programme Builder selectors, resource deduplication, and certificate-template creation", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(studio).toContain(".limit(1)");
    expect(studio).toContain("setAssessments([])");
    expect(studio).toContain("NIU could not inspect existing lesson resources");
    expect(studio).toContain("already attached to this lesson");
    expect(studio).toContain('from("certificate_templates").select("id,status")');
    expect(studio).toContain('from("certificate_templates").insert');
    expect(studio).toContain("certificate_template_key: templateKey");
    expect(studio).toContain("A course named");
    expect(studio).toContain("A module named");
    expect(studio).toContain("Approved lessons are locked. Create or edit protected content before lesson approval.");
    expect(studio).toContain("setCourseId(\"\")");
  });

  it("resets only lesson fields after successful create or edit and preserves module context", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(studio).toContain("const initialLessonForm = { title: \"\", description: \"\", kind: \"article\", minutes: \"30\", points: \"10\", objectives: \"\", required: true, transcript: \"\", captions: \"\" }");
    expect(studio).toContain("setLessonId(\"\"); setLessonForm(initialLessonForm)");
    expect(studio).not.toContain("setModuleId(\"\"); setLessonForm(initialLessonForm)");
    expect(studio).toContain("The lesson form was cleared");
    expect(studio).toContain("const scopeResult = existingLesson ? { error: null }");
    expect(studio).toContain("setError(insertError?.message ?? \"The lesson could not be created.\")");
  });

  it("prevents duplicate lessons in a module and supports editing an existing lesson", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(studio).toContain('supabase.rpc("niu_find_duplicate_lesson"');
    expect(studio).toContain("target_module_id: moduleId");
    expect(studio).toContain("target_title: lessonForm.title.trim()");
    expect(studio).toContain("excluded_lesson_id: lessonId || null");
    expect(studio).toContain("Technical detail: ${duplicateError.message}");
    expect(studio).not.toContain('from("lessons").select("id,title,status")');
    expect(studio).toContain("A lesson named");
    expect(studio).toContain("It is selected for editing instead of creating a duplicate");
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260902_niu_find_duplicate_lesson.sql"), "utf8");
    expect(migration).toContain("security definer");
    expect(migration).toContain("lower(btrim(l.title)) = lower(btrim(target_title))");
    expect(migration).toContain("and l.status <> 'archived'");
    expect(migration).toContain("limit 1");
    expect(migration).toContain("niu_is_academic_staff");
    expect(studio).toContain("const existingLesson = lessons.find(item => item.id === lessonId)");
    expect(studio).toContain('supabase.from("lessons").update(lessonPayload)');
    expect(studio).toContain("Approved lessons are locked");
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
    expect(studio).toContain('certificate_template_key: templateKey');
    expect(studio).toContain('step === "preview"');
    expect(studio).toContain('href: "/content-library"');
    expect(studio).toContain('href="/programme-publication"');
    expect(studio).toContain("Protected materials stay in private object storage.");
    const media = fs.readFileSync(path.join(root, "server", "routers", "media.ts"), "utf8");
    expect(media).toContain("Active enrollment is required to access this material.");
    expect(media).toContain("protected lesson media is temporarily unavailable");
    expect(media).toContain("protected learning resource is temporarily unavailable");
  });

  it("keeps the saved assessment selected and exposes its complete governed workspace", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    const builder = fs.readFileSync(path.join(root, "client", "src", "pages", "AssessmentBuilder.tsx"), "utf8");
    expect(studio).toContain("assessment_questions(question_id)");
    expect(studio).toContain("setAssessmentId(createdAssessment.id)");
    expect(studio).toContain("Open Assessment Builder");
    expect(studio).toContain("saveAssessmentRules");
    expect(studio).toContain("Refresh validation");
    expect(studio).toContain("Submit for Review");
    expect(studio).toContain("approved assessments are locked");
    expect(studio).toContain("niu_transition_academic_record");
    expect(builder).toContain("new URLSearchParams");
    expect(builder).toContain('rpc("niu_transition_academic_record"');
    expect(builder).toContain('onConflict: "assessment_id,question_id"');
  });
});
