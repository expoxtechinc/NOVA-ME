import { AlertCircle, CheckCircle2, FileUp, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import SiteShell from "@/components/SiteShell";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { analyzeCurriculumDocument, type CurriculumAnalysis, type ImportedCourse, type ImportedModule } from "../../../shared/curriculumImport";

type Role = "student" | "instructor" | "administrator" | "super_admin";
type School = { id: string; name: string; code: string };
type ImportRow = { id: string; source_file_name: string; status: string; analysis: CurriculumAnalysis; validation_errors: string[]; missing_information: string[]; generated_record_ids: Record<string, unknown> };

const permittedExtensions = /\.(md|markdown|txt)$/i;
const messageFor = (value: unknown, fallback: string) => value instanceof Error ? value.message : fallback;

export default function CurriculumImport() {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importRow, setImportRow] = useState<ImportRow | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [working, setWorking] = useState(false);
  const [step, setStep] = useState("Upload curriculum");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const staff = role === "instructor" || role === "administrator" || role === "super_admin";
  const analysis = importRow?.analysis;
  const canGenerate = Boolean(importRow && analysis && schoolId && analysis.validationErrors.length === 0 && analysis.missingInformation.length === 0 && analysis.department?.name && analysis.programme?.name && analysis.programme.description && analysis.programme.description.length >= 30 && analysis.courses.length);
  const counts = useMemo(() => analysis ? { courses: analysis.courses.length, modules: analysis.courses.reduce((total: number, course: ImportedCourse) => total + course.modules.length, 0), lessons: analysis.courses.reduce((total: number, course: ImportedCourse) => total + course.modules.reduce((nested: number, module: ImportedModule) => nested + module.lessons.length, 0), 0) } : null, [analysis]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    async function init() {
      const { data: session } = await supabase.auth.getSession();
      if (!active || !session.session) return;
      setUserId(session.session.user.id);
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.session.user.id).maybeSingle();
      if (!active) return;
      setRole((profile?.role as Role | undefined) ?? null);
      const { data: schoolRows } = await supabase.from("schools").select("id,name,code").order("name");
      if (active) { setSchools((schoolRows ?? []) as School[]); setSchoolId(schoolRows?.[0]?.id ?? ""); }
    }
    void init();
    return () => { active = false; };
  }, []);

  function clearFeedback() { setError(null); setNotice(null); }

  async function uploadAndAnalyze(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    if (!userId || !file) { setError("Choose an approved curriculum document before analysis."); return; }
    if (!permittedExtensions.test(file.name)) { setError("For this first import path, upload Markdown or plain text (.md, .markdown, or .txt). PDF and office-document parsing is not enabled, so NIU will not guess from binary content."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Curriculum documents must be 10 MB or smaller."); return; }
    setWorking(true); setStep("Upload → Analyze");
    try {
      const text = await file.text();
      const storagePath = `${userId}/curriculum-imports/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const upload = await supabase.storage.from("niu-learning-materials").upload(storagePath, file, { contentType: file.type || "text/plain", upsert: false });
      if (upload.error) throw upload.error;
      const parsed = analyzeCurriculumDocument(text, file.name);
      const { data, error: insertError } = await supabase.from("curriculum_imports").insert({ source_file_name: file.name, source_mime_type: file.type || "text/plain", source_storage_path: storagePath, status: "generated", analysis: parsed, validation_errors: parsed.validationErrors, missing_information: parsed.missingInformation, created_by: userId }).select("id,source_file_name,status,analysis,validation_errors,missing_information,generated_record_ids").single();
      if (insertError || !data) throw insertError ?? new Error("The private import record could not be created.");
      setSourceText(text); setImportRow(data as ImportRow); setStep("Validate → Review"); setNotice("The source was stored privately and analyzed without creating academic records. Review missing information before generating drafts.");
    } catch (caught) { setError(messageFor(caught, "NIU could not analyze this curriculum document.")); }
    setWorking(false);
  }

  async function updateImport(patch: Partial<ImportRow> & Record<string, unknown>) {
    if (!importRow) return;
    const { data, error: updateError } = await supabase.from("curriculum_imports").update(patch).eq("id", importRow.id).select("id,source_file_name,status,analysis,validation_errors,missing_information,generated_record_ids").single();
    if (updateError || !data) throw updateError ?? new Error("The import review state could not be saved.");
    setImportRow(data as ImportRow);
  }

  async function generateDrafts() {
    clearFeedback();
    if (!importRow || !analysis || !schoolId) { setError("Choose a school and analyze a curriculum before generating drafts."); return; }
    if (!analysis.department?.name || !analysis.programme?.name || !analysis.programme.description || analysis.programme.description.length < 30) { setError("Draft generation is blocked: department, programme, and a programme description of at least 30 characters are required. Correct the source or regenerate the incomplete analysis."); return; }
    setWorking(true); setStep("Generate draft");
    try {
      const departmentCode = (analysis.department.code || analysis.department.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 18).toUpperCase() || "IMPORTED-DEPT";
      const programmeCode = (analysis.programme.code || analysis.programme.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 24).toUpperCase() || "IMPORTED-PROGRAMME";
      const courseTitles = analysis.courses.map(course => course.title);
      const moduleKeys = analysis.courses.flatMap(course => course.modules.map(module => `${course.title.toLowerCase()}::${module.title.toLowerCase()}`));
      if (new Set(courseTitles.map(title => title.toLowerCase())).size !== courseTitles.length) throw new Error("Duplicate course titles were detected in the source. Correct the curriculum ordering before generating drafts.");
      if (new Set(moduleKeys).size !== moduleKeys.length) throw new Error("Duplicate module titles were detected within a course. Correct the curriculum ordering before generating drafts.");
      const [existingDepartment, existingProgramme, existingCourses] = await Promise.all([
        supabase.from("departments").select("id,name,code").eq("code", departmentCode).maybeSingle(),
        supabase.from("certificate_programs").select("id,name,code").eq("code", programmeCode).maybeSingle(),
        supabase.from("courses").select("id,title").in("title", courseTitles),
      ]);
      if (existingDepartment.data) throw new Error(`A department with code ${departmentCode} already exists. Review the existing record instead of importing a duplicate.`);
      if (existingProgramme.data) throw new Error(`A certificate programme with code ${programmeCode} already exists. Review the existing record instead of importing a duplicate.`);
      if (existingCourses.data?.length) throw new Error(`Duplicate course detected: ${existingCourses.data.map(course => course.title).join(", ")}. No imported drafts were created.`);
      if (existingDepartment.error || existingProgramme.error || existingCourses.error) throw new Error("NIU could not complete the duplicate preflight. No imported drafts were created; retry after the records can be checked.");
      const departmentResult = await supabase.from("departments").insert({ school_id: schoolId, code: departmentCode, name: analysis.department.name, description: analysis.department.description || null, status: "draft" }).select("id").single();
      if (departmentResult.error || !departmentResult.data) throw departmentResult.error ?? new Error("Department draft could not be created.");
      const programmeResult = await supabase.from("certificate_programs").insert({ department_id: departmentResult.data.id, code: programmeCode, name: analysis.programme.name, award_type: "certificate", description: analysis.programme.description, objectives: analysis.programme.objectives, learning_outcomes: [], duration_hours: 0, difficulty: analysis.programme.difficulty === "introductory" ? "beginner" : analysis.programme.difficulty || "beginner", required_score: 70, completion_requirements: { imported_source: importRow.source_file_name, explicit_rules: analysis.programme.completionRules || null }, status: "draft", governed_workflow: true, created_by: userId }).select("id").single();
      if (programmeResult.error || !programmeResult.data) throw programmeResult.error ?? new Error("Certificate programme draft could not be created.");
      const generated: Record<string, unknown> = { department_id: departmentResult.data.id, programme_id: programmeResult.data.id, courses: [], modules: [], lessons: [], question_banks: [], assessments: [], protected_materials: [], missing_information: analysis.missingInformation };
      for (const course of analysis.courses) {
        const courseResult = await supabase.from("courses").insert({ author_id: userId, slug: `${programmeCode.toLowerCase()}-${course.position + 1}-${course.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}`, title: course.title, description: course.description!, category: "Imported certificate curriculum", level: course.difficulty === "introductory" ? "beginner" : course.difficulty || "beginner", duration_minutes: 0, certificate_eligible: true, learning_outcomes: course.objectives, entry_requirements: [], status: "draft", governed_workflow: true }).select("id").single();
        if (courseResult.error || !courseResult.data) throw courseResult.error ?? new Error(`Course draft could not be created for ${course.title}.`);
        const courseId = courseResult.data.id;
        generated.courses = [...(generated.courses as string[]), courseId];
        const versionResult = await supabase.from("course_versions").insert({ course_id: courseId, version_number: 1, status: "draft", change_summary: `Imported from ${importRow.source_file_name}; requires governed review.`, snapshot: course, created_by: userId });
        if (versionResult.error) throw versionResult.error;
        const linkResult = await supabase.from("program_courses").insert({ program_id: programmeResult.data.id, course_id: courseId, position: course.position, is_required: true });
        if (linkResult.error) throw linkResult.error;
        const bankResult = await supabase.from("question_banks").insert({ department_id: departmentResult.data.id, title: `${course.title} · Imported question bank`, description: `Private draft bank generated from ${importRow.source_file_name}; questions require explicit source answer keys and governed approval.`, status: "draft", governed_workflow: true, created_by: userId }).select("id").single();
        if (bankResult.error || !bankResult.data) throw bankResult.error ?? new Error(`Question bank draft could not be created for ${course.title}.`);
        generated.question_banks = [...(generated.question_banks as string[]), bankResult.data.id];
        for (const module of course.modules) {
          const moduleResult = await supabase.from("course_modules").insert({ course_id: courseId, title: module.title, description: null, position: module.position, status: "draft", governed_workflow: true, learning_level: module.difficulty === "introductory" ? "foundation" : module.difficulty === "intermediate" ? "developing" : module.difficulty === "advanced" ? "advanced" : "foundation", estimated_minutes: 0, learning_objectives: module.objectives, support_guidance: null }).select("id").single();
          if (moduleResult.error || !moduleResult.data) throw moduleResult.error ?? new Error(`Module draft could not be created for ${module.title}.`);
          generated.modules = [...(generated.modules as string[]), moduleResult.data.id];
          for (const lesson of module.lessons) {
            const lessonResult = await supabase.from("lessons").insert({ module_id: moduleResult.data.id, title: lesson.title, description: lesson.knowledgeChecks.length ? `Explicit source knowledge checks require review: ${lesson.knowledgeChecks.join("; ")}` : null, position: lesson.position, kind: "article", rich_text: lesson.activities.length ? lesson.activities.join("\n") : null, is_required: true, learning_objectives: lesson.objectives, estimated_minutes: 0, points: 0, governed_workflow: true, status: "draft" }).select("id").single();
            if (lessonResult.error || !lessonResult.data) throw lessonResult.error ?? new Error(`Lesson draft could not be created for ${lesson.title}.`);
            generated.lessons = [...(generated.lessons as string[]), lessonResult.data.id];
          }
        }
        for (const title of course.assessments) {
          const assessmentResult = await supabase.from("assessments").insert({ course_id: courseId, title, assessment_type: "module_test", instructions: null, passing_score: 70, attempt_limit: null, time_limit_minutes: null, randomize_questions: true, randomize_answers: true, weight: 0, status: "draft", governed_workflow: true, required_completion_rules: { imported_source: importRow.source_file_name, requires_review: true }, created_by: userId }).select("id").single();
          if (assessmentResult.error || !assessmentResult.data) throw assessmentResult.error ?? new Error(`Assessment draft could not be created for ${title}.`);
          generated.assessments = [...(generated.assessments as string[]), assessmentResult.data.id];
        }
        if (course.finalExamination) {
          const finalResult = await supabase.from("assessments").insert({ course_id: courseId, title: course.finalExamination, assessment_type: "exam", instructions: "Imported final examination awaiting governed review; no questions were invented.", passing_score: 70, attempt_limit: null, time_limit_minutes: null, randomize_questions: true, randomize_answers: true, weight: 0, status: "draft", governed_workflow: true, required_completion_rules: { imported_source: importRow.source_file_name, requires_review: true, final_examination: true }, created_by: userId }).select("id").single();
          if (finalResult.error || !finalResult.data) throw finalResult.error ?? new Error(`Final examination draft could not be created for ${course.title}.`);
          generated.assessments = [...(generated.assessments as string[]), finalResult.data.id];
        }
      }
      await updateImport({ status: "review", generated_record_ids: generated, validation_errors: analysis.validationErrors, missing_information: analysis.missingInformation });
      setStep("Review"); setNotice("Draft records were generated from complete explicit source fields and remain private. Nothing was approved or published. Review every generated record in Course Studio before requesting governed approval.");
    } catch (caught) { setError(messageFor(caught, "Draft generation stopped. Existing records were not modified; review the error before retrying.")); }
    setWorking(false);
  }

  async function regenerateAnalysis() {
    if (!file) { setError("Choose the corrected curriculum source file before regenerating analysis."); return; }
    setImportRow(null); setNotice(null); setError(null); setSourceText("");
    const fakeEvent = { preventDefault() {} } as React.FormEvent;
    await uploadAndAnalyze(fakeEvent);
  }

  if (!supabaseConfigured || !userId) return <SiteShell><section className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-5 text-center"><ShieldAlert className="h-10 w-10 text-wine" /><h1 className="mt-5 font-serif text-4xl">NIU sign-in required.</h1><Link href="/signin" className="button-primary mt-7">Sign in to NIU</Link></section></SiteShell>;
  if (!staff) return <SiteShell><section className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-5 text-center"><ShieldAlert className="h-10 w-10 text-wine" /><h1 className="mt-5 font-serif text-4xl">Academic staff authority required.</h1><p className="mt-3 leading-7 text-ink/65">Curriculum Import is restricted to authorised instructional and administrative roles.</p><Link href="/portal" className="button-primary mt-7">Return to My NIU</Link></section></SiteShell>;
  return <SiteShell><section className="border-b border-wine/10 bg-canvas"><div className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8"><p className="eyebrow">Guided academic package · Curriculum Import</p><h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Import one approved curriculum into a reviewable draft package.</h1><p className="mt-3 max-w-4xl leading-7 text-ink/65">Upload → Analyze → Generate draft → Validate → Review → Approve → Publish. NIU extracts only explicit headings and statements, preserves their order, marks missing information, and never publishes or approves generated content.</p></div></section><main className="mx-auto grid max-w-[1320px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">{(error || notice) && <div className={`lg:col-span-2 flex gap-3 border-l-4 p-4 text-sm ${error ? "border-wine bg-wine/5" : "border-emerald-700 bg-emerald-50 text-emerald-900"}`}><AlertCircle className="h-5 w-5 shrink-0" />{error ?? notice}</div>}<section className="grid content-start gap-6"><form onSubmit={uploadAndAnalyze} className="border border-wine/10 bg-white p-6"><FileUp className="h-7 w-7 text-wine" /><h2 className="mt-4 font-serif text-2xl">Import Complete Curriculum</h2><p className="mt-2 text-sm leading-6 text-ink/60">Approved source documents are stored in private NIU storage. Markdown and plain text are accepted for this deterministic import path; unsupported binary formats are refused rather than guessed.</p><label className="mt-5 grid gap-2 text-sm font-semibold">Curriculum document<input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={event => setFile(event.target.files?.[0] ?? null)} className="block w-full text-sm" /></label><label className="mt-4 grid gap-2 text-sm font-semibold">School for imported department<select value={schoolId} onChange={event => setSchoolId(event.target.value)} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="">Choose a school</option>{schools.map(school => <option key={school.id} value={school.id}>{school.code} · {school.name}</option>)}</select></label><button disabled={working || !file} className="button-primary mt-5 inline-flex w-full items-center justify-center gap-2 disabled:opacity-60">{working ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{working ? "Analyzing…" : "Upload and analyze"}</button></form><section className="border border-wine/10 bg-ink p-6 text-paper"><p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Current stage</p><p className="mt-3 font-serif text-3xl">{step}</p><p className="mt-3 text-sm leading-6 text-paper/70">Generated records remain private drafts. Approval and publication are separate authorised actions in the existing NIU workflows.</p><div className="mt-5 grid gap-2 text-sm text-paper/80"><p>1. Upload curriculum</p><p>2. Analyze explicit structure</p><p>3. Generate draft package</p><p>4. Validate and review</p><p>5. Approve, then publish deliberately</p></div></section></section><section className="border border-wine/10 bg-white p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Validation and review</p><h2 className="mt-2 font-serif text-3xl">{importRow ? importRow.source_file_name : "No import analyzed yet"}</h2></div>{importRow && <span className="border border-wine/15 bg-canvas px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]">{importRow.status}</span>}</div>{!analysis ? <div className="mt-8 border border-dashed border-wine/20 bg-canvas p-8 text-center text-sm leading-7 text-ink/65">Upload an approved curriculum document to see its structure, ordering, missing-information markers, and draft-generation readiness. NIU will not create records during analysis.</div> : <div className="mt-7 grid gap-7"><div className="grid gap-3 sm:grid-cols-3">{counts && <><div className="border border-wine/10 p-4"><p className="text-xs uppercase tracking-[0.12em] text-ink/50">Courses</p><p className="mt-2 font-serif text-3xl">{counts.courses}</p></div><div className="border border-wine/10 p-4"><p className="text-xs uppercase tracking-[0.12em] text-ink/50">Modules</p><p className="mt-2 font-serif text-3xl">{counts.modules}</p></div><div className="border border-wine/10 p-4"><p className="text-xs uppercase tracking-[0.12em] text-ink/50">Lessons</p><p className="mt-2 font-serif text-3xl">{counts.lessons}</p></div></>}</div><div><h3 className="font-serif text-2xl">Detected structure</h3><div className="mt-4 grid gap-3">{analysis.courses.map((course: ImportedCourse, index: number) => <article key={`${course.title}-${index}`} className="border border-wine/10 bg-canvas p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-wine">Course {course.position + 1} · {course.difficulty || "difficulty missing"}</p><p className="mt-2 font-semibold">{course.title}</p><div className="mt-3 grid gap-2 pl-4 text-sm text-ink/65">{course.modules.map((module: ImportedModule) => <p key={`${course.title}-${module.title}`}>Module {module.position + 1}: {module.title} <span className="text-ink/45">({module.lessons.length} lessons)</span></p>)}</div></article>)}</div></div><div className="border border-amber-700/20 bg-amber-50 p-5"><h3 className="font-serif text-xl">Missing or blocked information</h3>{analysis.missingInformation.length ? <ul className="mt-3 grid gap-2 text-sm leading-6 text-amber-950">{analysis.missingInformation.map((item: string) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-3 text-sm text-amber-950">No missing-information markers were detected in the explicit source structure.</p>}{analysis.validationErrors.length > 0 && <div className="mt-4 border-t border-amber-700/20 pt-4 text-sm text-amber-950"><p className="font-semibold">Validation errors</p>{analysis.validationErrors.map((item: string) => <p key={item} className="mt-1">{item}</p>)}</div>}</div><div className="flex flex-wrap gap-3"><button type="button" onClick={generateDrafts} disabled={working || !canGenerate || Boolean(importRow?.generated_record_ids && Object.keys(importRow.generated_record_ids).length)} className="button-primary inline-flex items-center gap-2 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Generate private draft package</button><button type="button" onClick={regenerateAnalysis} disabled={working || !file} className="button-secondary inline-flex items-center gap-2"><RefreshCw className="h-4 w-4" />Regenerate incomplete sections</button></div><p className="text-sm leading-6 text-ink/60">{canGenerate ? "Generation is available because all required source fields are explicit and validated." : "Generation is blocked until every required source field is explicit, valid, and mapped to the selected school. Correct the source and regenerate; NIU will not invent missing academic information."}</p>{sourceText && <details className="border border-wine/10 p-4"><summary className="cursor-pointer text-sm font-semibold">Review source text ({sourceText.length.toLocaleString()} characters)</summary><pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink/65">{sourceText}</pre></details>}</div>}</section></main></SiteShell>;
}
