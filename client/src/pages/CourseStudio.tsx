import { AlertCircle, ArrowRight, BookOpen, Check, ChevronRight, ClipboardCheck, FileText, Layers3, LoaderCircle, Plus, Save, ShieldAlert, Sparkles, Target, Video, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import SiteShell from "@/components/SiteShell";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { LESSON_KIND_OPTIONS } from "@shared/lessonKinds";

type Role = "student" | "instructor" | "administrator" | "super_admin";
type Step = "programme" | "curriculum" | "lesson" | "content" | "assessment" | "rules" | "certificate" | "preview" | "review";
type Department = { id: string; name: string; code: string };
type Programme = { id: string; name: string; code: string; department_id: string; description: string; status: string; duration_hours: number; difficulty: string; required_score: number; completion_requirements: Record<string, unknown> | null; certificate_template_key: string | null; image_path: string | null };
type Course = { id: string; title: string; slug: string; description: string; status: string; level: string; duration_minutes: number };
type Module = { id: string; course_id: string; title: string; description: string | null; position: number; status: string; learning_level: string; estimated_minutes: number; learning_objectives: string[]; support_guidance: string | null };
type Lesson = { id: string; module_id: string; title: string; description: string | null; position: number; kind: string; status: string; is_required: boolean; estimated_minutes: number; points: number };

const steps: { id: Step; label: string; detail: string }[] = [
  { id: "programme", label: "Programme information", detail: "Identity, outcomes, requirements" },
  { id: "curriculum", label: "Courses and modules", detail: "Create and order the curriculum" },
  { id: "lesson", label: "Lessons", detail: "Activities, objectives, accessibility" },
  { id: "content", label: "Learning content", detail: "Notes, media, resources" },
  { id: "assessment", label: "Assessments", detail: "Checks, quizzes, exams" },
  { id: "rules", label: "Points and completion", detail: "Grading and eligibility" },
  { id: "certificate", label: "Certificate design", detail: "Template and verification" },
  { id: "preview", label: "Student preview", detail: "Read-only learner view" },
  { id: "review", label: "Validation and publish", detail: "Quality gate and workflow" },
];
const levels = ["foundation", "developing", "applied", "advanced", "capstone"];
const lessonKinds = LESSON_KIND_OPTIONS;
const listItems = (value: string) => value.split("\n").map(item => item.trim()).filter(Boolean);
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function CourseStudio() {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [programmeId, setProgrammeId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [step, setStep] = useState<Step>("programme");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [programmeForm, setProgrammeForm] = useState({ name: "", code: "", departmentId: "", description: "", objectives: "", outcomes: "", hours: "36", difficulty: "beginner", requirements: "", completion: "", template: "NIU-DIGITAL-STARTER-v1", image: "", score: "70" });
  const [courseForm, setCourseForm] = useState({ title: "", description: "", category: "Professional development", level: "beginner", minutes: "60", outcomes: "", requirements: "" });
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", level: "foundation", minutes: "60", objectives: "", support: "" });
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", kind: "article", minutes: "30", points: "10", objectives: "", required: true, transcript: "", captions: "" });
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [assessmentForm, setAssessmentForm] = useState({ title: "", type: "knowledge_check", passingScore: "70", attempts: "1", timeLimit: "", weight: "0" });
  const [rulesForm, setRulesForm] = useState({ requiredActivities: "Required lessons\nRequired readings\nRequired quizzes\nRequired assessments\nFinal examination", minimumScore: "70", examinationScore: "70" });
  const [certificateForm, setCertificateForm] = useState({ templateKey: "NIU-DIGITAL-STARTER-v1", presidentName: "Akin S. Sokpah — President and Founder", signatureIdentifier: "akinssokpah" });
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);
  const [contentCount, setContentCount] = useState(0);
  const [assessmentCount, setAssessmentCount] = useState(0);

  const staff = role === "instructor" || role === "administrator" || role === "super_admin";
  const selectedProgramme = programmes.find(item => item.id === programmeId) ?? null;
  const selectedCourse = courses.find(item => item.id === courseId) ?? null;
  const selectedModule = modules.find(item => item.id === moduleId) ?? null;
  const selectedLessons = lessons.filter(item => item.module_id === moduleId).sort((a, b) => a.position - b.position);
  const requiredLessons = lessons.filter(item => item.is_required);
  const unlockedStep = !programmeId ? 0 : !courseId ? 1 : !moduleId ? 2 : !lessonId && !selectedLessons.length ? 2 : contentCount === 0 ? 3 : assessmentCount === 0 ? 4 : 8;
  const checks = useMemo(() => [
    { label: "Programme identity and certificate-only award", ok: Boolean(selectedProgramme?.name && selectedProgramme.status !== "archived") },
    { label: "At least one course is attached", ok: courses.length > 0 },
    { label: "Every course has an ordered module", ok: courses.length > 0 && modules.length > 0 },
    { label: "Required lessons have learning structure", ok: requiredLessons.length > 0 && requiredLessons.every(item => item.title && item.estimated_minutes >= 0) },
    { label: "Protected learning material review", ok: false },
    { label: "Assessment and final examination review", ok: false },
    { label: "Certificate template and verification review", ok: selectedProgramme?.status === "approved" || selectedProgramme?.status === "published" },
  ], [courses.length, modules.length, requiredLessons, selectedProgramme]);

  const clearFeedback = () => { setNotice(null); setError(null); };
  useEffect(() => {
    if (typeof window === "undefined" || !staff) return;
    const key = `niu-programme-builder-draft:${programmeId || "new"}`;
    window.localStorage.setItem(key, JSON.stringify({ programmeForm, courseForm, moduleForm, lessonForm, assessmentForm, rulesForm, certificateForm, savedAt: Date.now() }));
    setAutosavedAt(Date.now());
  }, [staff, programmeId, programmeForm, courseForm, moduleForm, lessonForm, assessmentForm, rulesForm, certificateForm]);
  const update = <T extends Record<string, unknown>>(setter: React.Dispatch<React.SetStateAction<T>>, key: keyof T, value: T[keyof T]) => setter(current => ({ ...current, [key]: value }));

  async function loadStructure(nextProgrammeId?: string) {
    const [departmentResult, programmeResult] = await Promise.all([
      supabase.from("departments").select("id,name,code").order("name"),
      supabase.from("certificate_programs").select("id,name,code,department_id,description,status,duration_hours,difficulty,required_score,completion_requirements,certificate_template_key,image_path").order("updated_at", { ascending: false }),
    ]);
    if (departmentResult.error || programmeResult.error) throw new Error("NIU could not load Course Studio records for this account.");
    const nextProgrammes = (programmeResult.data ?? []) as Programme[];
    const activeProgrammeId = nextProgrammeId ?? programmeId ?? nextProgrammes[0]?.id ?? "";
    setDepartments((departmentResult.data ?? []) as Department[]);
    setProgrammes(nextProgrammes);
    setProgrammeId(activeProgrammeId);
    if (!activeProgrammeId) { setCourses([]); setModules([]); setLessons([]); setContentCount(0); setAssessmentCount(0); return; }
    const { data: links, error: linkError } = await supabase.from("program_courses").select("course_id,courses(id,title,slug,description,status,level,duration_minutes)").eq("program_id", activeProgrammeId).order("position");
    if (linkError) throw new Error("NIU could not load the programme course sequence.");
    const nextCourses = ((links ?? []).map(item => Array.isArray(item.courses) ? item.courses[0] : item.courses).filter(Boolean)) as Course[];
    setCourses(nextCourses);
    const ids = nextCourses.map(item => item.id);
    if (!ids.length) { setModules([]); setLessons([]); setContentCount(0); setAssessmentCount(0); return; }
    const { data: moduleData, error: moduleError } = await supabase.from("course_modules").select("id,course_id,title,description,position,status,learning_level,estimated_minutes,learning_objectives,support_guidance").in("course_id", ids).order("position");
    if (moduleError) throw new Error("NIU could not load the ordered module tree.");
    const nextModules = (moduleData ?? []) as Module[];
    setModules(nextModules);
    if (!nextModules.some(item => item.id === moduleId)) setModuleId(nextModules[0]?.id ?? "");
    const { data: lessonData, error: lessonError } = await supabase.from("lessons").select("id,module_id,title,description,position,kind,status,is_required,estimated_minutes,points").in("module_id", nextModules.map(item => item.id)).order("position");
    if (lessonError) throw new Error("NIU could not load the lesson tree.");
    const nextLessons = (lessonData ?? []) as Lesson[];
    setLessons(nextLessons);
    const lessonIds = nextLessons.map(item => item.id);
    if (lessonIds.length) {
      const { count: contentTotal } = await supabase.from("lesson_content_items").select("lesson_id", { count: "exact", head: true }).in("lesson_id", lessonIds);
      setContentCount(contentTotal ?? 0);
    } else setContentCount(0);
    const { count: assessmentTotal } = await supabase.from("assessments").select("id", { count: "exact", head: true }).in("course_id", ids);
    setAssessmentCount(assessmentTotal ?? 0);
  }

  useEffect(() => {
    if (!supabaseConfigured) { setError("The NIU account connection is not configured."); setLoading(false); return; }
    let active = true;
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active || !sessionData.session) { setLoading(false); return; }
      setUserId(sessionData.session.user.id);
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", sessionData.session.user.id).maybeSingle();
      if (!active) return;
      setRole((profile?.role as Role | undefined) ?? null);
      if (profile?.role && profile.role !== "student") { try { await loadStructure(); } catch (caught) { setError(caught instanceof Error ? caught.message : "NIU could not load Course Studio."); } }
      if (active) setLoading(false);
    }
    void init();
    return () => { active = false; };
  }, []);

  async function createProgramme(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    if (!userId || !programmeForm.departmentId || programmeForm.name.trim().length < 3 || programmeForm.code.trim().length < 2 || programmeForm.description.trim().length < 30) { setError("Complete the programme name, code, department, and a description of at least 30 characters."); return; }
    setSaving(true);
    const { data, error: insertError } = await supabase.from("certificate_programs").insert({ department_id: programmeForm.departmentId, name: programmeForm.name.trim(), code: programmeForm.code.trim().toUpperCase(), description: programmeForm.description.trim(), objectives: listItems(programmeForm.objectives), learning_outcomes: listItems(programmeForm.outcomes), duration_hours: Number(programmeForm.hours) || 0, difficulty: programmeForm.difficulty, required_score: Number(programmeForm.score) || 70, completion_requirements: { entry_requirements: listItems(programmeForm.requirements), completion_rules: listItems(programmeForm.completion) }, certificate_template_key: programmeForm.template.trim() || null, image_path: programmeForm.image.trim() || null, award_type: "certificate", status: "draft", governed_workflow: true, created_by: userId }).select("id").single();
    if (insertError || !data) setError(insertError?.message ?? "The draft certificate programme could not be created.");
    else { setNotice("Draft certificate programme created. Continue inside Course Studio to add its course and curriculum."); await loadStructure(data.id); setStep("curriculum"); }
    setSaving(false);
  }

  async function createCourse(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    if (!userId || !programmeId || courseForm.title.trim().length < 3 || courseForm.description.trim().length < 30) { setError("Choose a programme and provide a course title plus a description of at least 30 characters."); return; }
    setSaving(true);
    const payload = { author_id: userId, slug: slugify(courseForm.title), title: courseForm.title.trim(), description: courseForm.description.trim(), category: courseForm.category.trim() || "Professional development", level: courseForm.level, duration_minutes: Number(courseForm.minutes) || 0, certificate_eligible: true, learning_outcomes: listItems(courseForm.outcomes), entry_requirements: listItems(courseForm.requirements), status: "draft", governed_workflow: true };
    const { data: created, error: courseError } = await supabase.from("courses").insert(payload).select("id").single();
    if (courseError || !created) { setError(courseError?.message ?? "The draft course could not be created."); setSaving(false); return; }
    const { error: versionError } = await supabase.from("course_versions").insert({ course_id: created.id, version_number: 1, status: "draft", change_summary: "Initial Course Studio draft", snapshot: payload, created_by: userId });
    const { error: linkError } = await supabase.from("program_courses").insert({ program_id: programmeId, course_id: created.id, position: courses.length, is_required: true });
    if (versionError || linkError) setError(versionError?.message ?? linkError?.message ?? "The course was created but could not be connected to the programme.");
    else { setNotice("Draft course created and connected. Add modules without leaving Course Studio."); await loadStructure(programmeId); setCourseId(created.id); setStep("curriculum"); }
    setSaving(false);
  }

  async function createModule(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    if (!courseId || moduleForm.title.trim().length < 3) { setError("Choose a course and provide a module title."); return; }
    setSaving(true);
    const { data: last } = await supabase.from("course_modules").select("position").eq("course_id", courseId).order("position", { ascending: false }).limit(1);
    const { data: created, error: insertError } = await supabase.from("course_modules").insert({ course_id: courseId, title: moduleForm.title.trim(), description: moduleForm.description.trim() || null, position: Number(last?.[0]?.position ?? -1) + 1, status: "draft", governed_workflow: true, learning_level: moduleForm.level, estimated_minutes: Number(moduleForm.minutes) || 0, learning_objectives: listItems(moduleForm.objectives), support_guidance: moduleForm.support.trim() || null }).select("id").single();
    if (insertError || !created) setError(insertError?.message ?? "The module could not be created.");
    else {
      const { error: scopeError } = await supabase.from("program_modules").insert({ program_id: programmeId, module_id: created.id, position: Number(last?.[0]?.position ?? -1) + 1, is_required: true });
      if (scopeError) setError(`Module saved, but programme scope could not be recorded: ${scopeError.message}`);
      else { setNotice("Draft module saved and connected to this programme package. Add its first lesson below."); await loadStructure(programmeId); setModuleId(created.id); setStep("lesson"); }
    }
    setSaving(false);
  }

  async function uploadResource(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    const targetLessonId = lessonId || selectedLessons[0]?.id;
    if (!userId || !targetLessonId || !resourceFile || resourceTitle.trim().length < 3) { setError("Choose a lesson, provide a resource title, and select a file before uploading."); return; }
    if (resourceFile.size > 10 * 1024 * 1024) { setError("Learning resources must be 10 MB or smaller."); return; }
    setSaving(true);
    const safeName = resourceFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("niu-learning-materials").upload(storagePath, resourceFile, { contentType: resourceFile.type || "application/octet-stream", upsert: false });
    if (uploadError) { setError(uploadError.message); setSaving(false); return; }
    const { data: item, error: itemError } = await supabase.from("content_library_items").insert({ title: resourceTitle.trim(), category: "document", file_name: resourceFile.name, content_type: resourceFile.type || "application/octet-stream", storage_path: storagePath, description: resourceDescription.trim() || null, status: "draft", governed_workflow: true, created_by: userId }).select("id").single();
    if (itemError || !item) { await supabase.storage.from("niu-learning-materials").remove([storagePath]); setError(itemError?.message ?? "The library record could not be created."); setSaving(false); return; }
    const { error: attachmentError } = await supabase.from("lesson_content_items").insert({ lesson_id: targetLessonId, content_item_id: item.id, position: 0, is_required: true });
    if (attachmentError) { await supabase.from("content_library_items").delete().eq("id", item.id); await supabase.storage.from("niu-learning-materials").remove([storagePath]); setError(attachmentError.message); }
    else { setNotice("Private learning resource uploaded and attached to the selected lesson. Learners will receive it only through enrolled-course access."); setResourceTitle(""); setResourceDescription(""); setResourceFile(null); }
    setSaving(false);
  }

  async function saveProgrammeRules(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    if (!programmeId) { setError("Choose a certificate programme before saving completion rules."); return; }
    setSaving(true);
    const existing = selectedProgramme?.completion_requirements && typeof selectedProgramme.completion_requirements === "object" ? selectedProgramme.completion_requirements : {};
    const { error: updateError } = await supabase.from("certificate_programs").update({ required_score: Number(rulesForm.minimumScore) || 70, completion_requirements: { ...existing, required_activities: listItems(rulesForm.requiredActivities), final_examination_required: true, minimum_examination_score: Number(rulesForm.examinationScore) || 70 }, certificate_template_key: certificateForm.templateKey.trim() || null, image_path: programmeForm.image.trim() || null }).eq("id", programmeId);
    if (updateError) setError(updateError.message);
    else { setNotice("Completion and certificate settings saved to the draft programme. Eligibility remains calculated by NIU’s server-side workflow and publication is still gated."); await loadStructure(programmeId); }
    setSaving(false);
  }

  async function createAssessment(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    const title = assessmentForm.title.trim(); const passingScore = Number(assessmentForm.passingScore); const attempts = Number(assessmentForm.attempts); const timeLimit = assessmentForm.timeLimit ? Number(assessmentForm.timeLimit) : null; const weight = Number(assessmentForm.weight);
    if (!userId || !courseId || title.length < 3) { setError("Choose a course and provide an assessment title of at least three characters."); return; }
    if (!Number.isFinite(passingScore) || passingScore <= 0 || passingScore > 100) { setError("Assessment passing score must be greater than 0 and no more than 100."); return; }
    if (!Number.isInteger(attempts) || attempts <= 0) { setError("Assessment attempt limit must be a whole number greater than zero."); return; }
    if (timeLimit !== null && (!Number.isInteger(timeLimit) || timeLimit <= 0)) { setError("Assessment time limit must be a whole number of minutes greater than zero."); return; }
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) { setError("Assessment weight must be between 0 and 100."); return; }
    setSaving(true);
    const duplicateQuery = supabase.from("assessments").select("id,title,status").eq("course_id", courseId).ilike("title", title).neq("status", "archived");
    const { data: duplicate, error: duplicateError } = moduleId ? await duplicateQuery.eq("module_id", moduleId).maybeSingle() : await duplicateQuery.is("module_id", null).maybeSingle();
    if (duplicateError) { setError("NIU could not check for duplicate assessments. Nothing was created; please retry."); setSaving(false); return; }
    if (duplicate) { setError(`A non-archived assessment named “${duplicate.title}” already exists in this course/module (${duplicate.status}). Edit or reuse that record instead of creating a duplicate.`); setSaving(false); return; }
    const { error: insertError } = await supabase.from("assessments").insert({ course_id: courseId, module_id: moduleId || null, title, assessment_type: assessmentForm.type, passing_score: passingScore, attempt_limit: attempts, time_limit_minutes: timeLimit, randomize_questions: true, randomize_answers: true, weight, required_completion_rules: { required: true, minimum_score: passingScore, attempt_limit: attempts, time_limit_minutes: timeLimit }, status: "draft", governed_workflow: true, created_by: userId });
    if (insertError) setError(insertError.message.includes("duplicate") || insertError.code === "23505" ? "This assessment already exists for the selected course/module. Reuse the existing record instead of creating a duplicate." : insertError.message);
    else { setNotice("Draft assessment saved. It is not published, approved, or review-ready until its questions, completion rules, and validation checks are complete."); setAssessmentForm({ title: "", type: "knowledge_check", passingScore: "70", attempts: "1", timeLimit: "", weight: "0" }); }
    setSaving(false);
  }

  async function createLesson(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    if (!moduleId || lessonForm.title.trim().length < 3) { setError("Choose a module and provide a lesson title."); return; }
    setSaving(true);
    const { data: last } = await supabase.from("lessons").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1);
    const { data: createdLesson, error: insertError } = await supabase.from("lessons").insert({ module_id: moduleId, title: lessonForm.title.trim(), kind: lessonForm.kind, description: lessonForm.description.trim() || null, position: Number(last?.[0]?.position ?? -1) + 1, rich_text: lessonForm.kind === "article" ? lessonForm.description.trim() || null : null, is_required: lessonForm.required, learning_objectives: listItems(lessonForm.objectives), estimated_minutes: Number(lessonForm.minutes) || 0, points: Number(lessonForm.points) || 0, governed_workflow: true, caption_text: lessonForm.captions.trim() || null, transcript_text: lessonForm.transcript.trim() || null, status: "draft" }).select("id").single();
    if (insertError || !createdLesson) setError(insertError?.message ?? "The lesson could not be created.");
    else {
      const { error: scopeError } = await supabase.from("program_lessons").insert({ program_id: programmeId, module_id: moduleId, lesson_id: createdLesson.id, position: Number(last?.[0]?.position ?? -1) + 1, is_required: lessonForm.required });
      if (scopeError) setError(`Lesson saved, but programme scope could not be recorded: ${scopeError.message}`);
      else { setNotice("Draft lesson saved in the selected module and connected to this programme package. Continue with protected content and assessments in this workspace."); await loadStructure(programmeId); setStep("content"); }
    }
    setSaving(false);
  }

  if (loading) return <SiteShell><div className="grid min-h-[55vh] place-items-center"><LoaderCircle className="h-8 w-8 animate-spin text-wine" /></div></SiteShell>;
  if (!staff) return <SiteShell><section className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-5 text-center"><ShieldAlert className="h-10 w-10 text-wine" /><h1 className="mt-5 font-serif text-4xl">Programme Builder is restricted.</h1><p className="mt-3 leading-7 text-ink/65">Only authorised instructional and administrative roles can create or revise NIU academic content.</p><Link href={role ? "/portal" : "/signin"} className="button-primary mt-7">{role ? "Return to My NIU" : "Sign in to NIU"}</Link></section></SiteShell>;

  const programmeFields = [
    ["Programme name", "name", "input"], ["Programme code", "code", "input"], ["Learning hours", "hours", "number"], ["Minimum score", "score", "number"],
  ] as const;
  const contentCards = [
    { icon: FileText, title: "Learning notes", text: "Attach private PDF, DOCX, PPTX, Markdown, text, research, and study-guide resources to the selected lesson.", href: "/content-library" },
    { icon: Video, title: "Video and accessibility", text: "Record transcript, captions, duration, required viewing, and server-validated learner progress.", href: "/institutional-builder" },
    { icon: BookOpen, title: "In-browser reader", text: "Learners receive signed private access with completion evidence and mobile-safe opening feedback.", href: "/content-preview" },
    { icon: Target, title: "External resource", text: "Register only authorised HTTPS references; NIU does not claim ownership of external material.", href: "/content-library" },
  ];

  return <SiteShell>
    <section className="border-b border-wine/10 bg-ink text-paper"><div className="mx-auto max-w-[1500px] px-5 py-10 sm:px-8"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><p className="eyebrow text-gold">Unified academic authoring</p><h1 className="mt-3 font-serif text-5xl tracking-[-0.04em]">Programme Builder</h1><p className="mt-3 max-w-3xl leading-7 text-paper/70">Create a complete certificate programme in one governed workspace. Steps unlock in order, completed sections remain editable, and every save stays draft-only until the authorised publication gate approves the selected package.</p></div><div className="flex flex-wrap gap-3 text-sm"><Link href="/admin" className="border border-paper/30 px-4 py-3 font-bold text-paper">Admin dashboard</Link><Link href="/programme-publication" className="border border-gold px-4 py-3 font-bold text-gold">Publication gate</Link></div></div></div></section>
    <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8"><div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
      <aside className="border border-wine/10 bg-white p-4 lg:sticky lg:top-5 lg:h-fit"><div className="flex items-center gap-2 border-b border-wine/10 pb-4"><Sparkles className="h-5 w-5 text-wine" /><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-wine">Studio steps</p><p className="text-sm text-ink/60">One workspace, no dead ends</p></div></div><nav className="mt-4 grid gap-1">{steps.map((item, index) => <button key={item.id} type="button" disabled={index > unlockedStep} onClick={() => { if (index <= unlockedStep) { setStep(item.id); clearFeedback(); } }} className={`flex items-start gap-3 p-3 text-left transition ${step === item.id ? "bg-wine text-paper" : index > unlockedStep ? "cursor-not-allowed text-ink/30" : "text-ink hover:bg-canvas"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${step === item.id ? "bg-gold text-ink" : "bg-canvas text-wine"}`}>{index + 1}</span><span><span className="block text-sm font-bold">{item.label}</span><span className={`mt-0.5 block text-xs ${step === item.id ? "text-paper/70" : "text-ink/55"}`}>{item.detail}</span></span></button>)}</nav></aside>
      <main className="min-w-0">
        {(notice || error) && <div className={`mb-5 flex gap-3 border-l-4 p-4 text-sm ${error ? "border-wine bg-wine/5" : "border-emerald-700 bg-emerald-50 text-emerald-900"}`}>{error ? <X className="h-5 w-5 shrink-0" /> : <Check className="h-5 w-5 shrink-0" />}<span>{error ?? notice}</span></div>}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">{steps.find(item => item.id === step)?.label}</p><h2 className="mt-2 font-serif text-4xl">{selectedProgramme?.name ?? "Start a new certificate programme"}</h2><p className="mt-2 text-sm text-ink/60">{selectedProgramme ? `${selectedProgramme.code} · ${selectedProgramme.status} · certificate-only` : "Draft records stay unpublished until authorised review."}</p><p className="mt-2 text-xs text-ink/50">{autosavedAt ? `Private browser draft saved ${new Date(autosavedAt).toLocaleTimeString()}. Database saves remain governed and draft-only.` : "Private browser draft autosave is ready."}</p></div><div className="flex flex-wrap gap-2"><label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-ink/55">Programme<select value={programmeId} onChange={event => void loadStructure(event.target.value)} className="min-w-[220px] border border-wine/20 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal"><option value="">Choose a programme</option>{programmes.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-ink/55">Course<select value={courseId} onChange={event => { setCourseId(event.target.value); setModuleId(modules.find(item => item.course_id === event.target.value)?.id ?? ""); }} className="min-w-[220px] border border-wine/20 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal"><option value="">Choose a course</option>{courses.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div></div>

        {step === "programme" && <section className="border border-wine/10 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Step 1</p><h3 className="mt-2 font-serif text-3xl">Programme information</h3><p className="mt-2 text-sm leading-6 text-ink/65">A programme is always certificate-only. Save a draft first; this does not publish a public listing.</p></div><Target className="h-7 w-7 text-wine" /></div><form onSubmit={createProgramme} className="mt-7 grid gap-4 md:grid-cols-2">{programmeFields.map(([label, key, type]) => <label key={key} className="grid gap-2 text-sm font-semibold">{label}<input type={type} min={type === "number" ? "0" : undefined} value={programmeForm[key]} onChange={event => update(setProgrammeForm, key, event.target.value)} className="border border-wine/20 px-3 py-3 font-normal" /></label>)}<label className="grid gap-2 text-sm font-semibold">Department<select value={programmeForm.departmentId} onChange={event => update(setProgrammeForm, "departmentId", event.target.value)} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="">Choose a department</option>{departments.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">Difficulty<select value={programmeForm.difficulty} onChange={event => update(setProgrammeForm, "difficulty", event.target.value)} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><Field label="Description" value={programmeForm.description} onChange={value => update(setProgrammeForm, "description", value)} wide /><Field label="Programme objectives" value={programmeForm.objectives} onChange={value => update(setProgrammeForm, "objectives", value)} /><Field label="Learning outcomes" value={programmeForm.outcomes} onChange={value => update(setProgrammeForm, "outcomes", value)} /><Field label="Entry requirements" value={programmeForm.requirements} onChange={value => update(setProgrammeForm, "requirements", value)} /><Field label="Completion requirements" value={programmeForm.completion} onChange={value => update(setProgrammeForm, "completion", value)} /><Field label="Certificate template key" value={programmeForm.template} onChange={value => update(setProgrammeForm, "template", value)} /><Field label="Programme image or approved reference" value={programmeForm.image} onChange={value => update(setProgrammeForm, "image", value)} /><div className="md:col-span-2 flex flex-wrap gap-3"><button disabled={saving} className="button-primary"><Save className="h-4 w-4" />{saving ? "Saving draft…" : "Save draft programme"}</button><button type="button" onClick={() => setStep("curriculum")} className="button-secondary">Save & continue <ArrowRight className="h-4 w-4" /></button></div></form></section>}

        {step === "curriculum" && <div className="grid gap-6"><section className="border border-wine/10 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Step 2</p><h3 className="mt-2 font-serif text-3xl">Curriculum builder</h3><p className="mt-2 text-sm leading-6 text-ink/65">Select real programme records from the tree. New courses and modules are connected automatically in learner order.</p></div><Layers3 className="h-7 w-7 text-wine" /></div><CurriculumTree courses={courses} modules={modules} lessons={lessons} courseId={courseId} moduleId={moduleId} onCourse={setCourseId} onModule={id => { setModuleId(id); setStep("lesson"); }} onLesson={id => { setLessonId(id); setStep("lesson"); }} /><CourseForm form={courseForm} setForm={setCourseForm} onSubmit={createCourse} saving={saving} disabled={!selectedProgramme} /><div className="mt-6 border-t border-wine/10 pt-6"><ModuleForm form={moduleForm} setForm={setModuleForm} onSubmit={createModule} saving={saving} disabled={!courseId} /></div></section></div>}

        {step === "lesson" && <section className="border border-wine/10 bg-white p-6"><p className="eyebrow">Step 3</p><h3 className="mt-2 font-serif text-3xl">Lesson builder</h3><p className="mt-2 text-sm leading-6 text-ink/65">Lessons stay inside their selected module. Add objectives, duration, points, transcript, and captions before connecting protected resources.</p><div className="mt-5 flex flex-wrap gap-2">{modules.filter(item => item.course_id === courseId).map(item => <button type="button" key={item.id} onClick={() => setModuleId(item.id)} className={`border px-3 py-2 text-sm font-bold ${item.id === moduleId ? "border-wine bg-wine text-paper" : "border-wine/20 text-wine"}`}>Module {item.position + 1}: {item.title}</button>)}</div>{selectedModule && <div className="mt-6 border-l-4 border-gold bg-gold/10 p-4 text-sm"><b>{selectedModule.title}</b><span className="ml-2 text-ink/60">{selectedModule.learning_level} · {selectedModule.estimated_minutes} minutes</span></div>}<LessonForm form={lessonForm} setForm={setLessonForm} onSubmit={createLesson} saving={saving} disabled={!moduleId} /></section>}

        {step === "content" && <ContentStudioPanel lessons={selectedLessons} lessonId={lessonId || selectedLessons[0]?.id || ""} setLessonId={setLessonId} title={resourceTitle} setTitle={setResourceTitle} description={resourceDescription} setDescription={setResourceDescription} file={resourceFile} setFile={setResourceFile} onSubmit={uploadResource} saving={saving} />}

        {step === "assessment" && <AssessmentStudioPanel form={assessmentForm} setForm={setAssessmentForm} onSubmit={createAssessment} saving={saving} disabled={!courseId} />}

        {step === "rules" && <StudioPanel eyebrow="Step 6" title="Points and completion" icon={<Target className="h-7 w-7 text-wine" />}><form onSubmit={saveProgrammeRules} className="grid gap-4 md:grid-cols-2"><Field label="Required activities" value={rulesForm.requiredActivities} onChange={value => setRulesForm(current => ({ ...current, requiredActivities: value }))} wide /><label className="grid gap-2 text-sm font-semibold">Minimum programme score<input value={rulesForm.minimumScore} onChange={event => setRulesForm(current => ({ ...current, minimumScore: event.target.value }))} type="number" min="0" max="100" className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Minimum examination score<input value={rulesForm.examinationScore} onChange={event => setRulesForm(current => ({ ...current, examinationScore: event.target.value }))} type="number" min="0" max="100" className="border border-wine/20 px-3 py-3 font-normal" /></label><button disabled={saving || !programmeId} className="button-primary w-fit"><Save className="h-4 w-4" />Save completion rules</button></form><Notice>Server validation remains authoritative. Course Studio shows the plan, while learner completion and certificate eligibility continue to be calculated by NIU’s existing protected functions.</Notice></StudioPanel>}
        {step === "certificate" && <StudioPanel eyebrow="Step 7" title="Certificate design" icon={<Target className="h-7 w-7 text-wine" />}><form onSubmit={saveProgrammeRules} className="grid gap-4 md:grid-cols-2"><Field label="Certificate template key" value={certificateForm.templateKey} onChange={value => setCertificateForm(current => ({ ...current, templateKey: value }))} /><Field label="University logo or approved reference" value={programmeForm.image} onChange={value => update(setProgrammeForm, "image", value)} /><Field label="President name" value={certificateForm.presidentName} onChange={value => setCertificateForm(current => ({ ...current, presidentName: value }))} /><Field label="Signature identifier" value={certificateForm.signatureIdentifier} onChange={value => setCertificateForm(current => ({ ...current, signatureIdentifier: value }))} /><div className="border border-gold/40 bg-gold/10 p-6 md:col-span-2"><h4 className="font-serif text-2xl">NIU certificate-only credential</h4><p className="mt-3 text-sm leading-6 text-ink/70">Student name · programme name · credential number · completion date · issue date · learning hours · final score · QR verification</p><p className="mt-3 text-sm font-bold text-wine">President and Founder: Akin S. Sokpah · Signature identifier: akinssokpah</p></div><button disabled={saving || !programmeId} className="button-primary w-fit"><Save className="h-4 w-4" />Save certificate settings</button></form></StudioPanel>}
        {step === "preview" && <StudioPanel eyebrow="Step 8" title="Student preview" icon={<BookOpen className="h-7 w-7 text-wine" />}><p className="text-sm leading-6 text-ink/65">This preview is read-only. It reflects the selected course’s real records and never grants a learner access to draft materials.</p><div className="mt-5 grid gap-3">{modules.filter(item => item.course_id === courseId).map(item => <div key={item.id} className="border border-wine/10 bg-canvas p-4"><b>Module {item.position + 1}: {item.title}</b><p className="mt-1 text-sm text-ink/60">{lessons.filter(lesson => lesson.module_id === item.id).length} lessons · {item.learning_level}</p></div>)}</div></StudioPanel>}
        {step === "review" && <StudioPanel eyebrow="Step 9" title="Validation and publish" icon={<ClipboardCheck className="h-7 w-7 text-wine" />}><div className="grid gap-3">{checks.map(item => <div key={item.label} className={`flex items-center gap-3 border p-4 ${item.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-wine/15 bg-wine/5 text-ink/75"}`}>{item.ok ? <Check className="h-5 w-5 text-emerald-700" /> : <AlertCircle className="h-5 w-5 text-wine" />}<span className="text-sm font-semibold">{item.label}</span><span className="ml-auto text-xs font-bold uppercase">{item.ok ? "Complete" : "Required review"}</span></div>)}</div><div className="mt-6 flex flex-wrap gap-3"><Link href="/programme-publication" className="button-primary">Open final publication gate <ArrowRight className="h-4 w-4" /></Link><Link href="/programme-package" className="button-secondary">View package readiness</Link></div><p className="mt-4 text-xs leading-5 text-ink/55">Course Studio does not bypass the existing publication gate. Critical missing materials, assessments, or review decisions must be resolved before publication.</p></StudioPanel>}
      </main>
      <aside className="grid content-start gap-5 lg:sticky lg:top-5 lg:h-fit"><section className="border border-wine/10 bg-white p-5"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-wine" /><p className="eyebrow">Progress checklist</p></div><p className="mt-3 font-serif text-3xl">{checks.filter(item => item.ok).length}/{checks.length}</p><p className="text-sm text-ink/60">gates currently complete</p><div className="mt-4 h-2 overflow-hidden bg-canvas"><div className="h-full bg-wine transition-all" style={{ width: `${Math.round((checks.filter(item => item.ok).length / checks.length) * 100)}%` }} /></div><div className="mt-5 grid gap-3">{checks.map(item => <div key={item.label} className="flex gap-2 text-xs leading-5"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.ok ? "bg-emerald-600" : "bg-wine/30"}`} /><span className={item.ok ? "text-ink/70" : "text-ink/50"}>{item.label}</span></div>)}</div></section><section className="border border-wine/10 bg-ink p-5 text-paper"><p className="eyebrow text-gold">Workspace guardrails</p><ul className="mt-4 grid gap-3 text-sm leading-6 text-paper/75"><li>Draft changes remain unpublished.</li><li>Protected materials stay in private object storage.</li><li>Relationships use real programme, course, module, and lesson records.</li><li>Final publishing remains reviewer-authorised and certificate-only.</li></ul></section></aside>
    </div></section>
  </SiteShell>;
}

function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) { return <label className={`grid gap-2 text-sm font-semibold ${wide ? "md:col-span-2" : ""}`}>{label}<textarea value={value} onChange={event => onChange(event.target.value)} rows={wide ? 4 : 3} className="border border-wine/20 px-3 py-3 font-normal" /></label>; }
function Notice({ children }: { children: React.ReactNode }) { return <div className="mt-6 border border-wine/10 bg-canvas p-5 text-sm leading-6 text-ink/65">{children}</div>; }
function StudioPanel({ eyebrow, title, icon, children }: { eyebrow: string; title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="border border-wine/10 bg-white p-7"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-full bg-canvas">{icon}</div><div><p className="eyebrow">{eyebrow}</p><h3 className="mt-2 font-serif text-3xl">{title}</h3></div></div><div className="mt-7">{children}</div></section>; }
function StudioCards({ eyebrow, title, text, cards }: { eyebrow: string; title: string; text: string; cards: { icon: typeof FileText; title: string; text: string; href: string }[] }) { return <StudioPanel eyebrow={eyebrow} title={title} icon={<FileText className="h-7 w-7 text-wine" />}><p className="leading-7 text-ink/65">{text}</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{cards.map(item => <article key={item.title} className="border border-wine/10 bg-canvas p-5"><item.icon className="h-5 w-5 text-wine" /><h4 className="mt-4 font-serif text-xl">{item.title}</h4><p className="mt-2 text-sm leading-6 text-ink/65">{item.text}</p><Link href={item.href} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-wine">Open governed editor <ArrowRight className="h-4 w-4" /></Link></article>)}</div></StudioPanel>; }
function CurriculumTree({ courses, modules, lessons, courseId, moduleId, onCourse, onModule, onLesson }: { courses: Course[]; modules: Module[]; lessons: Lesson[]; courseId: string; moduleId: string; onCourse: (id: string) => void; onModule: (id: string) => void; onLesson: (id: string) => void }) { return <div className="mt-6 rounded-sm border border-wine/10 bg-canvas p-4"><p className="font-serif text-xl">Programme curriculum</p>{courses.length ? courses.map(course => <div key={course.id} className="mt-3"><button type="button" onClick={() => onCourse(course.id)} className={`flex w-full items-center gap-2 text-left font-bold ${courseId === course.id ? "text-wine" : "text-ink"}`}><ChevronRight className="h-4 w-4" />{course.title}<span className="ml-auto text-xs font-normal uppercase text-ink/50">{course.status}</span></button>{courseId === course.id && modules.filter(item => item.course_id === course.id).map(module => <div key={module.id} className="ml-6 mt-2 border-l border-wine/20 pl-4"><button type="button" onClick={() => onModule(module.id)} className={`flex w-full items-center gap-2 text-left text-sm font-bold ${moduleId === module.id ? "text-wine" : "text-ink/75"}`}><ChevronRight className="h-3 w-3" />Module {module.position + 1}: {module.title}<span className="ml-auto text-xs font-normal text-ink/45">{lessons.filter(item => item.module_id === module.id).length} lessons</span></button>{moduleId === module.id && lessons.filter(item => item.module_id === module.id).sort((a, b) => a.position - b.position).map(lesson => <button key={lesson.id} type="button" onClick={() => onLesson(lesson.id)} className="ml-5 mt-2 flex w-[calc(100%-1.25rem)] items-center gap-2 text-left text-xs text-ink/65"><FileText className="h-3 w-3 text-wine" />{lesson.position + 1}. {lesson.title}</button>)}</div>)}</div>) : <p className="mt-5 text-sm text-ink/60">No course is attached yet. Create the first course below.</p>}</div>; }
function CourseForm({ form, setForm, onSubmit, saving, disabled }: { form: { title: string; description: string; category: string; level: string; minutes: string; outcomes: string; requirements: string }; setForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; category: string; level: string; minutes: string; outcomes: string; requirements: string }>>; onSubmit: (event: React.FormEvent) => void; saving: boolean; disabled: boolean }) { return <form onSubmit={onSubmit} className="mt-7 grid gap-4 border-t border-wine/10 pt-6"><h4 className="font-serif text-2xl">Add course to this programme</h4><div className="grid gap-4 md:grid-cols-2"><Field label="Course title" value={form.title} onChange={value => setForm(current => ({ ...current, title: value }))} /><label className="grid gap-2 text-sm font-semibold">Difficulty<select value={form.level} onChange={event => setForm(current => ({ ...current, level: event.target.value }))} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><Field label="Description" value={form.description} onChange={value => setForm(current => ({ ...current, description: value }))} wide /><label className="grid gap-2 text-sm font-semibold">Learning minutes<input type="number" min="0" value={form.minutes} onChange={event => setForm(current => ({ ...current, minutes: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label><Field label="Category" value={form.category} onChange={value => setForm(current => ({ ...current, category: value }))} /><Field label="Learning outcomes" value={form.outcomes} onChange={value => setForm(current => ({ ...current, outcomes: value }))} /><Field label="Entry requirements" value={form.requirements} onChange={value => setForm(current => ({ ...current, requirements: value }))} /></div><button disabled={saving || disabled} className="button-primary w-fit"><Plus className="h-4 w-4" />{saving ? "Creating course…" : "Save course and continue"}</button></form>; }
function ModuleForm({ form, setForm, onSubmit, saving, disabled }: { form: { title: string; description: string; level: string; minutes: string; objectives: string; support: string }; setForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; level: string; minutes: string; objectives: string; support: string }>>; onSubmit: (event: React.FormEvent) => void; saving: boolean; disabled: boolean }) { return <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2"><h4 className="font-serif text-2xl md:col-span-2">Add module without leaving Course Studio</h4><Field label="Module title" value={form.title} onChange={value => setForm(current => ({ ...current, title: value }))} /><label className="grid gap-2 text-sm font-semibold">Learning level<select value={form.level} onChange={event => setForm(current => ({ ...current, level: event.target.value }))} className="border border-wine/20 bg-white px-3 py-3 font-normal">{levels.map(item => <option key={item} value={item}>{item}</option>)}</select></label><Field label="Description" value={form.description} onChange={value => setForm(current => ({ ...current, description: value }))} wide /><label className="grid gap-2 text-sm font-semibold">Estimated minutes<input type="number" min="0" value={form.minutes} onChange={event => setForm(current => ({ ...current, minutes: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label><Field label="Learning objectives" value={form.objectives} onChange={value => setForm(current => ({ ...current, objectives: value }))} /><Field label="Learner-support guidance" value={form.support} onChange={value => setForm(current => ({ ...current, support: value }))} wide /><button disabled={saving || disabled} className="button-primary w-fit"><Plus className="h-4 w-4" />{saving ? "Saving module…" : "Save module"}</button></form>; }
function LessonForm({ form, setForm, onSubmit, saving, disabled }: { form: { title: string; description: string; kind: string; minutes: string; points: string; objectives: string; required: boolean; transcript: string; captions: string }; setForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; kind: string; minutes: string; points: string; objectives: string; required: boolean; transcript: string; captions: string }>>; onSubmit: (event: React.FormEvent) => void; saving: boolean; disabled: boolean }) { return <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2"><Field label="Lesson title" value={form.title} onChange={value => setForm(current => ({ ...current, title: value }))} /><label className="grid gap-2 text-sm font-semibold">Activity type<select value={form.kind} onChange={event => setForm(current => ({ ...current, kind: event.target.value }))} className="border border-wine/20 bg-white px-3 py-3 font-normal">{lessonKinds.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><Field label="Description" value={form.description} onChange={value => setForm(current => ({ ...current, description: value }))} wide /><label className="grid gap-2 text-sm font-semibold">Estimated minutes<input type="number" min="0" value={form.minutes} onChange={event => setForm(current => ({ ...current, minutes: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Points<input type="number" min="0" value={form.points} onChange={event => setForm(current => ({ ...current, points: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label><Field label="Learning objectives" value={form.objectives} onChange={value => setForm(current => ({ ...current, objectives: value }))} /><Field label="Transcript" value={form.transcript} onChange={value => setForm(current => ({ ...current, transcript: value }))} /><Field label="Captions" value={form.captions} onChange={value => setForm(current => ({ ...current, captions: value }))} /><label className="flex items-center gap-3 border border-wine/10 bg-canvas p-3 text-sm font-semibold"><input type="checkbox" checked={form.required} onChange={event => setForm(current => ({ ...current, required: event.target.checked }))} />Required lesson</label><button disabled={saving || disabled} className="button-primary w-fit"><Plus className="h-4 w-4" />{saving ? "Saving lesson…" : "Save lesson"}</button></form>; }

function ContentStudioPanel({ lessons, lessonId, setLessonId, title, setTitle, description, setDescription, file, setFile, onSubmit, saving }: { lessons: Lesson[]; lessonId: string; setLessonId: (id: string) => void; title: string; setTitle: (value: string) => void; description: string; setDescription: (value: string) => void; file: File | null; setFile: (value: File | null) => void; onSubmit: (event: React.FormEvent) => void; saving: boolean }) {
  return <StudioPanel eyebrow="Step 4" title="Learning content" icon={<FileText className="h-7 w-7 text-wine" />}>
    <p className="leading-7 text-ink/65">Upload an authorised learning resource directly into the selected lesson. Files are stored in NIU’s private bucket and delivered to enrolled learners through short-lived signed URLs.</p>
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
      <label className="grid gap-2 text-sm font-semibold">Lesson<select value={lessonId} onChange={event => setLessonId(event.target.value)} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="">Choose a lesson</option>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-semibold">Resource title<input value={title} onChange={event => setTitle(event.target.value)} className="border border-wine/20 px-3 py-3 font-normal" /></label>
      <label className="grid gap-2 text-sm font-semibold md:col-span-2">Description<textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} className="border border-wine/20 px-3 py-3 font-normal" /></label>
      <label className="grid gap-2 text-sm font-semibold md:col-span-2">Private file<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.mp3,.mp4,.webm" onChange={event => setFile(event.target.files?.[0] ?? null)} className="border border-wine/20 bg-white px-3 py-3 font-normal" /><span className="text-xs font-normal text-ink/55">Maximum 10 MB. Store only authorised teaching resources.</span></label>
      <button disabled={saving} className="button-primary w-fit"><Plus className="h-4 w-4" />{saving ? "Uploading securely…" : "Upload and attach resource"}</button>
    </form>
    <div className="mt-7 grid gap-4 sm:grid-cols-3"><article className="border border-wine/10 bg-canvas p-4"><FileText className="h-5 w-5 text-wine" /><h4 className="mt-3 font-serif text-lg">Learning notes</h4><p className="mt-1 text-xs leading-5 text-ink/65">PDF, Word, PowerPoint, Markdown, and text notes stay private.</p></article><article className="border border-wine/10 bg-canvas p-4"><Video className="h-5 w-5 text-wine" /><h4 className="mt-3 font-serif text-lg">Video accessibility</h4><p className="mt-1 text-xs leading-5 text-ink/65">Use the lesson editor for transcript, caption, and progress metadata.</p></article><article className="border border-wine/10 bg-canvas p-4"><BookOpen className="h-5 w-5 text-wine" /><h4 className="mt-3 font-serif text-lg">Learner reader</h4><p className="mt-1 text-xs leading-5 text-ink/65">Learners open resources only after active or completed enrolment.</p></article></div>
  </StudioPanel>;
}

function AssessmentStudioPanel({ form, setForm, onSubmit, saving, disabled }: { form: { title: string; type: string; passingScore: string; attempts: string; timeLimit: string; weight: string }; setForm: React.Dispatch<React.SetStateAction<{ title: string; type: string; passingScore: string; attempts: string; timeLimit: string; weight: string }>>; onSubmit: (event: React.FormEvent) => void; saving: boolean; disabled: boolean }) {
  return <StudioPanel eyebrow="Step 5" title="Assessments" icon={<ClipboardCheck className="h-7 w-7 text-wine" />}>
    <p className="leading-7 text-ink/65">Create a governed draft assessment for the selected course or module. Add questions through the approved question-bank flow before review and publication.</p>
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
      <Field label="Assessment title" value={form.title} onChange={value => setForm(current => ({ ...current, title: value }))} wide />
      <label className="grid gap-2 text-sm font-semibold">Assessment type<select value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value }))} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="knowledge_check">Knowledge check</option><option value="quiz">Quiz</option><option value="module_test">Module assessment</option><option value="final_assessment">Final assessment</option><option value="exam">Final examination</option></select></label>
      <label className="grid gap-2 text-sm font-semibold">Passing score<input type="number" min="0" max="100" value={form.passingScore} onChange={event => setForm(current => ({ ...current, passingScore: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label>
      <label className="grid gap-2 text-sm font-semibold">Attempt limit<input type="number" min="1" value={form.attempts} onChange={event => setForm(current => ({ ...current, attempts: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label>
      <label className="grid gap-2 text-sm font-semibold">Time limit in minutes<input type="number" min="1" value={form.timeLimit} onChange={event => setForm(current => ({ ...current, timeLimit: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label>
      <label className="grid gap-2 text-sm font-semibold">Weighted contribution<input type="number" min="0" max="100" value={form.weight} onChange={event => setForm(current => ({ ...current, weight: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label>
      <button disabled={saving || disabled} className="button-primary w-fit"><Plus className="h-4 w-4" />{saving ? "Saving assessment…" : "Save draft assessment"}</button>
    </form>
    <Notice><strong>Workflow status: Draft.</strong> Saving never publishes or approves an assessment. Before Review, provide a valid passing score (1–100), positive time limit, positive attempt limit, saved completion rules, and approved attached questions. NIU will explain each missing requirement and only an authorised administrator can approve or publish; published assessments cannot be returned to Draft.</Notice>
  </StudioPanel>;
}
