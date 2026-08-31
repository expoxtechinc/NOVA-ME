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
type CourseFormState = { title: string; description: string; category: string; level: string; minutes: string; outcomes: string; requirements: string };
type Module = { id: string; course_id: string; title: string; description: string | null; position: number; status: string; learning_level: string; estimated_minutes: number; learning_objectives: string[]; support_guidance: string | null };
type Lesson = { id: string; module_id: string; title: string; description: string | null; position: number; kind: string; status: string; is_required: boolean; estimated_minutes: number; points: number };
type Assessment = { id: string; title: string; assessment_type: string; status: string; course_id: string; passing_score: number; attempt_limit: number | null; time_limit_minutes: number | null; required_completion_rules: Record<string, unknown> | null; question_count: number };
type Readiness = { program_status: string; courses: number; approved_courses: number; modules: number; approved_modules: number; required_lessons: number; approved_required_lessons: number; required_lessons_with_material: number; governed_assessments: number; ready_governed_assessments: number; certificate_templates: number; approved_certificate_templates: number; ready: boolean };

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
const buildCourseInsertPayload = (form: CourseFormState, authorId: string) => ({ author_id: authorId, slug: slugify(form.title), title: form.title.trim(), description: form.description.trim(), category: form.category.trim() || "Professional development", level: form.level, duration_minutes: Number(form.minutes) || 0, certificate_eligible: true, learning_outcomes: listItems(form.outcomes), entry_requirements: listItems(form.requirements), status: "draft", governed_workflow: true });
const initialLessonForm = { title: "", description: "", kind: "article", minutes: "30", points: "10", objectives: "", required: true, transcript: "", captions: "" };

export default function CourseStudio() {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [certificateTemplateId, setCertificateTemplateId] = useState("");
  const [certificateTemplateStatus, setCertificateTemplateStatus] = useState("draft");
  const [programmeId, setProgrammeId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [step, setStep] = useState<Step>("programme");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [programmeForm, setProgrammeForm] = useState({ name: "", code: "", departmentId: "", description: "", objectives: "", outcomes: "", hours: "36", difficulty: "beginner", requirements: "", completion: "", template: "NIU-DIGITAL-STARTER-v1", image: "", score: "70" });
  const [courseForm, setCourseForm] = useState({ title: "", description: "", category: "Professional development", level: "beginner", minutes: "60", outcomes: "", requirements: "" });
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", level: "foundation", minutes: "60", objectives: "", support: "" });
  const [lessonForm, setLessonForm] = useState(initialLessonForm);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [assessmentForm, setAssessmentForm] = useState({ title: "", type: "knowledge_check", passingScore: "70", attempts: "1", timeLimit: "", weight: "0" });
  const [assessmentId, setAssessmentId] = useState("");
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
  const selectedCourseApproved = selectedCourse?.status === "approved" || selectedCourse?.status === "published";
  const selectedModuleApproved = selectedModule?.status === "approved" || selectedModule?.status === "published";
  const requiredLessonsApproved = requiredLessons.length > 0 && requiredLessons.every(item => item.status === "approved" || item.status === "published");
  const curriculumApproved = selectedCourseApproved && selectedModuleApproved && requiredLessonsApproved;
  const unlockedStep = !programmeId ? 0 : !courseId ? 1 : !moduleId ? 2 : !lessonId && !selectedLessons.length ? 2 : contentCount === 0 ? 3 : !curriculumApproved ? 3 : assessmentCount === 0 ? 4 : 8;
  const checks = useMemo(() => [
    { label: "Programme identity and certificate-only award", ok: Boolean(selectedProgramme?.name && selectedProgramme.status !== "archived") },
    { label: "Approved required courses in this programme", ok: Boolean(readiness?.courses === 1 && readiness.approved_courses === 1) },
    { label: "Approved modules in this programme", ok: Boolean(readiness?.modules === 1 && readiness.approved_modules === 1) },
    { label: "Approved required lessons with learning structure", ok: Boolean(readiness?.required_lessons === 1 && readiness.approved_required_lessons === 1 && requiredLessons.every(item => item.title && item.estimated_minutes >= 0)) },
    { label: "Protected material attached to every required lesson", ok: Boolean(readiness?.required_lessons === 1 && readiness.required_lessons_with_material === 1) },
    { label: "One governed assessment exists", ok: Boolean(readiness?.governed_assessments === 1) },
    { label: "Certificate template and verification review", ok: Boolean(selectedProgramme?.certificate_template_key && selectedProgramme.status !== "archived") },
  ], [readiness, requiredLessons, selectedProgramme]);

  const clearFeedback = () => { setNotice(null); setError(null); setReadiness(null); };
  const selectLessonForEdit = (lesson: Lesson) => { setLessonId(lesson.id); setLessonForm({ ...initialLessonForm, title: lesson.title, description: lesson.description ?? "", kind: lesson.kind, minutes: String(lesson.estimated_minutes ?? 0), points: String(lesson.points ?? 0), required: lesson.is_required }); };
  useEffect(() => {
    if (typeof window === "undefined" || !staff) return;
    const key = `niu-programme-builder-draft:${programmeId || "new"}`;
    window.localStorage.setItem(key, JSON.stringify({ programmeForm, courseForm, moduleForm, lessonForm, assessmentForm, rulesForm, certificateForm, savedAt: Date.now() }));
    setAutosavedAt(Date.now());
  }, [staff, programmeId, programmeForm, courseForm, moduleForm, lessonForm, assessmentForm, rulesForm, certificateForm]);

  async function transitionRecord(recordType: "course" | "module" | "lesson" | "assessment" | "certificate_template", recordId: string, targetStatus: "review" | "approved") {
    clearFeedback(); setSaving(true);
    const { error: transitionError } = await supabase.rpc("niu_transition_academic_record", { target_type: recordType, target_id: recordId, target_status: targetStatus });
    if (transitionError) setError(transitionError.message);
    else { setNotice(`${recordType.replace("_", " ")} moved to ${targetStatus}. The programme record was not changed.`); await loadStructure(programmeId); await runReadiness(); }
    setSaving(false);
  }

  async function runReadiness() {
    if (!programmeId) { setError("Choose a certificate programme before validating it."); return; }
    setSaving(true); setError(null);
    const { data, error: rpcError } = await supabase.rpc("niu_programme_bundle_readiness", { target_program_id: programmeId });
    if (rpcError) setError(rpcError.message);
    else { const result = data as Readiness; setReadiness(result); setNotice(result.ready ? "Database readiness passed for this programme package. Publication is now available through the authorised publication gate." : "Database readiness found required work in this programme package. Review the items below before publication."); }
    setSaving(false);
  }
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
    if (!activeProgrammeId) { setCourses([]); setModules([]); setLessons([]); setAssessments([]); setCourseId(""); setModuleId(""); setLessonId(""); setAssessmentId(""); setCertificateTemplateId(""); setContentCount(0); setAssessmentCount(0); return; }
    const { data: links, error: linkError } = await supabase.from("program_courses").select("course_id,courses(id,title,slug,description,status,level,duration_minutes)").eq("program_id", activeProgrammeId).order("position");
    if (linkError) throw new Error("NIU could not load the programme course sequence.");
    const nextCourses = ((links ?? []).map(item => Array.isArray(item.courses) ? item.courses[0] : item.courses).filter(Boolean)) as Course[];
    setCourses(nextCourses);
    const activeCourseId = nextCourses.some(item => item.id === courseId) ? courseId : nextCourses[0]?.id ?? "";
    setCourseId(activeCourseId);
    const ids = nextCourses.map(item => item.id);
    if (!ids.length) { setModules([]); setLessons([]); setAssessments([]); setCourseId(""); setModuleId(""); setLessonId(""); setAssessmentId(""); setContentCount(0); setAssessmentCount(0); return; }
    const { data: moduleData, error: moduleError } = await supabase.from("course_modules").select("id,course_id,title,description,position,status,learning_level,estimated_minutes,learning_objectives,support_guidance").in("course_id", ids).order("position");
    if (moduleError) throw new Error("NIU could not load the ordered module tree.");
    const nextModules = (moduleData ?? []) as Module[];
    setModules(nextModules);
    const activeModuleId = nextModules.some(item => item.id === moduleId && item.course_id === activeCourseId) ? moduleId : nextModules.find(item => item.course_id === activeCourseId)?.id ?? nextModules[0]?.id ?? "";
    setModuleId(activeModuleId);
    const { data: lessonData, error: lessonError } = await supabase.from("lessons").select("id,module_id,title,description,position,kind,status,is_required,estimated_minutes,points").in("module_id", nextModules.map(item => item.id)).order("position");
    if (lessonError) throw new Error("NIU could not load the lesson tree.");
    const nextLessons = (lessonData ?? []) as Lesson[];
    setLessons(nextLessons);
    const lessonIds = nextLessons.map(item => item.id);
    if (lessonIds.length) {
      const { count: contentTotal } = await supabase.from("lesson_content_items").select("lesson_id", { count: "exact", head: true }).in("lesson_id", lessonIds);
      setContentCount(contentTotal ?? 0);
    } else setContentCount(0);
    const { data: assessmentData, error: assessmentError } = await supabase.from("assessments").select("id,title,assessment_type,status,course_id,passing_score,attempt_limit,time_limit_minutes,required_completion_rules,assessment_questions(question_id)").in("course_id", ids).order("created_at");
    if (assessmentError) throw new Error("NIU could not load programme assessments.");
    const nextAssessments = ((assessmentData ?? []) as Array<Assessment & { assessment_questions?: Array<{ question_id: string }> }>).map(item => ({ ...item, question_count: item.assessment_questions?.length ?? 0 }));
    setAssessments(nextAssessments);
    setAssessmentCount(nextAssessments.length);
    setAssessmentId(current => nextAssessments.some(item => item.id === current) ? current : nextAssessments.find(item => item.course_id === activeCourseId)?.id ?? nextAssessments[0]?.id ?? "");
    const templateKey = nextProgrammes.find(item => item.id === activeProgrammeId)?.certificate_template_key;
    if (templateKey) {
      const { data: template } = await supabase.from("certificate_templates").select("id,status").eq("template_key", templateKey).maybeSingle();
      setCertificateTemplateId(template?.id ?? "");
      setCertificateTemplateStatus(template?.status ?? "draft");
    } else { setCertificateTemplateId(""); setCertificateTemplateStatus("draft"); }
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
    const duplicateCourse = courses.find(item => item.title.trim().toLocaleLowerCase() === courseForm.title.trim().toLocaleLowerCase());
    if (duplicateCourse) { setCourseId(duplicateCourse.id); setError(`A course named “${duplicateCourse.title}” is already attached to this programme. It is selected instead of creating a duplicate.`); return; }
    setSaving(true);
    const payload = buildCourseInsertPayload(courseForm, userId);
    const { data: created, error: courseError } = await supabase.from("courses").insert(payload).select("id").single();
    if (courseError || !created) { setError(courseError?.message ?? "The draft course could not be created."); setSaving(false); return; }
    const { error: versionError } = await supabase.from("course_versions").insert({ course_id: created.id, version_number: 1, status: "draft", change_summary: "Initial Course Studio draft", snapshot: payload, created_by: userId });
    const { error: linkError } = await supabase.from("program_courses").insert({ program_id: programmeId, course_id: created.id, position: courses.length, is_required: true });
    if (versionError || linkError) setError(versionError?.message ?? linkError?.message ?? "The course was created but could not be connected to the programme.");
    else { setNotice("Draft course created and connected. Add modules without leaving Course Studio."); await loadStructure(programmeId); setCourseId(created.id); setModuleId(""); setCourseForm({ title: "", description: "", category: "Professional development", level: "beginner", minutes: "60", outcomes: "", requirements: "" }); setStep("curriculum"); }
    setSaving(false);
  }

  async function createModule(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    if (!courseId || moduleForm.title.trim().length < 3) { setError("Choose a course and provide a module title."); return; }
    const duplicateModule = modules.find(item => item.course_id === courseId && item.title.trim().toLocaleLowerCase() === moduleForm.title.trim().toLocaleLowerCase());
    if (duplicateModule) { setModuleId(duplicateModule.id); setError(`A module named “${duplicateModule.title}” already exists in this course. It is selected instead of creating a duplicate.`); return; }
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
    const targetLesson = lessons.find(item => item.id === targetLessonId);
    if (targetLesson?.status === "approved" || targetLesson?.status === "published") { setError("Approved lessons are locked. Create or edit protected content before lesson approval."); return; }
    if (resourceFile.size > 10 * 1024 * 1024) { setError("Learning resources must be 10 MB or smaller."); return; }
    setSaving(true);
    const { data: attachedRows, error: attachedError } = await supabase.from("lesson_content_items").select("content_item_id").eq("lesson_id", targetLessonId);
    if (attachedError) { setError(`NIU could not inspect existing lesson resources: ${attachedError.message}`); setSaving(false); return; }
    const attachedIds = (attachedRows ?? []).map(item => item.content_item_id);
    if (attachedIds.length) {
      const { data: existingResources, error: resourceCheckError } = await supabase.from("content_library_items").select("id,title").in("id", attachedIds);
      if (resourceCheckError) { setError(`NIU could not check for duplicate resource titles: ${resourceCheckError.message}`); setSaving(false); return; }
      const duplicateResource = (existingResources ?? []).find(item => item.title.trim().toLocaleLowerCase() === resourceTitle.trim().toLocaleLowerCase());
      if (duplicateResource) { setError(`A resource titled “${duplicateResource.title}” is already attached to this lesson. Reuse the existing protected resource instead of creating a duplicate.`); setSaving(false); return; }
    }
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
    const templateKey = certificateForm.templateKey.trim();
    if (!templateKey) { setError("Enter a certificate template key before saving certificate settings."); setSaving(false); return; }
    const { data: existingTemplate, error: templateLookupError } = await supabase.from("certificate_templates").select("id,status").eq("template_key", templateKey).maybeSingle();
    if (templateLookupError) { setError(`NIU could not verify the certificate template: ${templateLookupError.message}`); setSaving(false); return; }
    const templateConfiguration = { presidentName: certificateForm.presidentName, signatureIdentifier: certificateForm.signatureIdentifier };
    if (existingTemplate?.status === "approved" || existingTemplate?.status === "published") { setError("Approved certificate templates are locked. Create a new template version for changes."); setSaving(false); return; }
    if (!existingTemplate) {
      const { error: templateInsertError } = await supabase.from("certificate_templates").insert({ template_key: templateKey, title: `${selectedProgramme?.name ?? "NIU Certificate"} template`, description: "Governed certificate template created from Programme Builder.", configuration: templateConfiguration, status: "draft", governed_workflow: true, created_by: userId });
      if (templateInsertError) { setError(`Certificate template could not be created: ${templateInsertError.message}`); setSaving(false); return; }
    } else {
      const { error: templateUpdateError } = await supabase.from("certificate_templates").update({ configuration: templateConfiguration, updated_at: new Date().toISOString() }).eq("id", existingTemplate.id).in("status", ["draft", "review"]);
      if (templateUpdateError) { setError(`Certificate template could not be updated: ${templateUpdateError.message}`); setSaving(false); return; }
    }
    const existing = selectedProgramme?.completion_requirements && typeof selectedProgramme.completion_requirements === "object" ? selectedProgramme.completion_requirements : {};
    const { error: updateError } = await supabase.from("certificate_programs").update({ required_score: Number(rulesForm.minimumScore) || 70, completion_requirements: { ...existing, required_activities: listItems(rulesForm.requiredActivities), final_examination_required: true, minimum_examination_score: Number(rulesForm.examinationScore) || 70 }, certificate_template_key: templateKey, image_path: programmeForm.image.trim() || null }).eq("id", programmeId);
    if (updateError) setError(updateError.message);
    else { setNotice("Completion and certificate settings saved to the draft programme. Eligibility remains calculated by NIU’s server-side workflow and publication is still gated."); await loadStructure(programmeId); }
    setSaving(false);
  }

  useEffect(() => {
    const current = lessons.find(item => item.id === lessonId);
    if (!current || step !== "lesson") return;
    setLessonForm({ title: current.title, description: current.description ?? "", kind: current.kind, minutes: String(current.estimated_minutes ?? 0), points: String(current.points ?? 0), objectives: "", required: current.is_required, transcript: "", captions: "" });
  }, [lessonId, lessons, step]);

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
    const { data: duplicateRows, error: duplicateError } = moduleId ? await duplicateQuery.eq("module_id", moduleId).limit(1) : await duplicateQuery.is("module_id", null).limit(1);
    if (duplicateError) { setError(`NIU could not check for duplicate assessments: ${duplicateError.message}`); setSaving(false); return; }
    const duplicate = duplicateRows?.[0];
    if (duplicate) { setError(`A non-archived assessment named “${duplicate.title}” already exists in this course/module (${duplicate.status}). Edit or reuse that record instead of creating a duplicate.`); setSaving(false); return; }
    const { data: createdAssessment, error: insertError } = await supabase.from("assessments").insert({ course_id: courseId, module_id: moduleId || null, title, assessment_type: assessmentForm.type, passing_score: passingScore, attempt_limit: attempts, time_limit_minutes: timeLimit, randomize_questions: true, randomize_answers: true, weight, required_completion_rules: { required: true, minimum_score: passingScore, attempt_limit: attempts, time_limit_minutes: timeLimit }, status: "draft", governed_workflow: true, created_by: userId }).select("id").single();
    if (insertError || !createdAssessment) setError(insertError?.message ?? "The assessment could not be created.");
    else { setAssessmentId(createdAssessment.id); setNotice("Draft assessment saved. Configure its completion rules and questions below, then submit it for review."); setAssessmentForm({ title: "", type: "knowledge_check", passingScore: "70", attempts: "1", timeLimit: "", weight: "0" }); await loadStructure(programmeId); await runReadiness(); }
    setSaving(false);
  }

  async function saveAssessmentRules(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    const assessment = assessments.find(item => item.id === assessmentId);
    if (!assessment) { setError("Choose a saved assessment before configuring completion rules."); return; }
    if (assessment.status === "approved" || assessment.status === "published") { setError("Approved assessments are locked. Create a new assessment version for changes."); return; }
    const requiredActivities = listItems(rulesForm.requiredActivities);
    const minimumScore = Number(rulesForm.minimumScore);
    const examinationScore = Number(rulesForm.examinationScore);
    if (!requiredActivities.length || !Number.isFinite(minimumScore) || minimumScore <= 0 || minimumScore > 100 || !Number.isFinite(examinationScore) || examinationScore <= 0 || examinationScore > 100) { setError("Completion rules require at least one activity and scores between 1 and 100."); return; }
    setSaving(true);
    const rules = { required: true, required_activities: requiredActivities, minimum_score: minimumScore, attempt_limit: assessment.attempt_limit, time_limit_minutes: assessment.time_limit_minutes, final_examination_required: true, minimum_examination_score: examinationScore };
    const { error: updateError } = await supabase.from("assessments").update({ required_completion_rules: rules, updated_at: new Date().toISOString() }).eq("id", assessment.id).in("status", ["draft", "review"]);
    if (updateError) setError(`Completion rules could not be saved: ${updateError.message}`);
    else { setNotice("Assessment completion rules saved. Readiness was refreshed."); await loadStructure(programmeId); await runReadiness(); }
    setSaving(false);
  }

  async function createLesson(event: React.FormEvent) {
    event.preventDefault(); clearFeedback();
    if (!moduleId || lessonForm.title.trim().length < 3) { setError("Choose a module and provide a lesson title."); return; }
    setSaving(true);
    const { data: duplicateRows, error: duplicateError } = await supabase.rpc("niu_find_duplicate_lesson", { target_module_id: moduleId, target_title: lessonForm.title.trim(), excluded_lesson_id: lessonId || null });
    if (duplicateError) { console.error("NIU duplicate lesson lookup failed", { moduleId, lessonId: lessonId || null, code: duplicateError.code, details: duplicateError.details }); setError(`NIU could not check for duplicate lessons. Nothing was created; please retry. Technical detail: ${duplicateError.message}`); setSaving(false); return; }
    const duplicate = duplicateRows?.[0];
    if (duplicate) { setLessonId(duplicate.id); setError(`A lesson named “${duplicate.title}” already exists in this module (${duplicate.status}). It is selected for editing instead of creating a duplicate.`); setSaving(false); return; }
    const existingLesson = lessons.find(item => item.id === lessonId);
    if (existingLesson?.status === "approved" || existingLesson?.status === "published") { setError("Approved lessons are locked. Create a new governed draft or use the existing lesson without changing it."); setSaving(false); return; }
    const { data: last } = await supabase.from("lessons").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1);
    const lessonPayload = { module_id: moduleId, title: lessonForm.title.trim(), kind: lessonForm.kind, description: lessonForm.description.trim() || null, position: existingLesson?.position ?? Number(last?.[0]?.position ?? -1) + 1, rich_text: lessonForm.kind === "article" ? lessonForm.description.trim() || null : null, is_required: lessonForm.required, learning_objectives: listItems(lessonForm.objectives), estimated_minutes: Number(lessonForm.minutes) || 0, points: Number(lessonForm.points) || 0, governed_workflow: true, caption_text: lessonForm.captions.trim() || null, transcript_text: lessonForm.transcript.trim() || null, status: existingLesson?.status ?? "draft" };
    const { data: createdLesson, error: insertError } = existingLesson ? await supabase.from("lessons").update(lessonPayload).eq("id", existingLesson.id).select("id").single() : await supabase.from("lessons").insert(lessonPayload).select("id").single();
    if (insertError || !createdLesson) setError(insertError?.message ?? "The lesson could not be created.");
    else {
      const scopeResult = existingLesson ? { error: null } : await supabase.from("program_lessons").insert({ program_id: programmeId, module_id: moduleId, lesson_id: createdLesson.id, position: Number(last?.[0]?.position ?? -1) + 1, is_required: lessonForm.required });
      if (scopeResult.error) setError(`Lesson saved, but programme scope could not be recorded: ${scopeResult.error.message}`);
      else { await loadStructure(programmeId); setLessonId(""); setLessonForm(initialLessonForm); setNotice(existingLesson ? "Lesson changes saved. The lesson form was cleared; choose the lesson below to edit it again or use its workflow action." : "Draft lesson saved. The lesson form was cleared; choose the lesson below to edit it or continue with protected content."); setStep("lesson"); }
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

        {step === "curriculum" && <div className="grid gap-6"><section className="border border-wine/10 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Step 2</p><h3 className="mt-2 font-serif text-3xl">Course structure</h3><p className="mt-2 text-sm leading-6 text-ink/65">Create a course record, attach it to the selected programme, then continue to its modules. Course fields are intentionally isolated from programme information.</p></div><Layers3 className="h-7 w-7 text-wine" /></div>{selectedProgramme && <div className="mt-6 border-l-4 border-gold bg-gold/10 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-wine">Selected programme</p><p className="mt-1 font-serif text-2xl">{selectedProgramme.code} · {selectedProgramme.name}</p><p className="mt-1 text-sm text-ink/60">Programme information is read-only in Step 2. Saving below creates a separate course record.</p></div>}<CurriculumTree courses={courses} modules={modules} lessons={lessons} courseId={courseId} moduleId={moduleId} onCourse={setCourseId} onModule={id => { setModuleId(id); setStep("lesson"); }} onLesson={id => { const lesson = lessons.find(item => item.id === id); if (lesson) selectLessonForEdit(lesson); setStep("lesson"); }} />{selectedCourse && <WorkflowAction recordType="course" recordId={selectedCourse.id} status={selectedCourse.status} onTransition={transitionRecord} saving={saving} />}{selectedModule && <WorkflowAction recordType="module" recordId={selectedModule.id} status={selectedModule.status} onTransition={transitionRecord} saving={saving} />}<CourseForm form={courseForm} setForm={setCourseForm} onSubmit={createCourse} saving={saving} disabled={!selectedProgramme} /><div className="mt-6 border-t border-wine/10 pt-6"><ModuleForm form={moduleForm} setForm={setModuleForm} onSubmit={createModule} saving={saving} disabled={!courseId} /></div></section></div>}

        {step === "lesson" && <section className="border border-wine/10 bg-white p-6"><p className="eyebrow">Step 3</p><h3 className="mt-2 font-serif text-3xl">Lesson builder</h3><p className="mt-2 text-sm leading-6 text-ink/65">Lessons stay inside their selected module. Add objectives, duration, points, transcript, and captions before connecting protected resources.</p><div className="mt-5 flex flex-wrap gap-2">{modules.filter(item => item.course_id === courseId).map(item => <button type="button" key={item.id} onClick={() => setModuleId(item.id)} className={`border px-3 py-2 text-sm font-bold ${item.id === moduleId ? "border-wine bg-wine text-paper" : "border-wine/20 text-wine"}`}>Module {item.position + 1}: {item.title}</button>)}</div>{selectedModule && <div className="mt-6 border-l-4 border-gold bg-gold/10 p-4 text-sm"><b>{selectedModule.title}</b><span className="ml-2 text-ink/60">{selectedModule.learning_level} · {selectedModule.estimated_minutes} minutes</span></div>}{selectedLessons.find(item => item.id === lessonId) && <WorkflowAction recordType="lesson" recordId={lessonId} status={selectedLessons.find(item => item.id === lessonId)?.status ?? "draft"} onTransition={transitionRecord} saving={saving} />}<LessonForm form={lessonForm} setForm={setLessonForm} onSubmit={createLesson} saving={saving} disabled={!moduleId} /><div className="mt-8 border-t border-wine/10 pt-6"><h4 className="font-serif text-2xl">Existing lessons in this module</h4>{selectedLessons.length ? <div className="mt-4 grid gap-3">{selectedLessons.map(lesson => <article key={lesson.id} className="border border-wine/10 bg-canvas p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{lesson.position + 1}. {lesson.title}</p><p className="text-xs uppercase tracking-[0.12em] text-ink/50">Status: {lesson.status} · {lesson.is_required ? "Required" : "Optional"}</p></div><button type="button" onClick={() => selectLessonForEdit(lesson)} disabled={lesson.status === "approved" || lesson.status === "published"} className="button-secondary">{lesson.status === "approved" || lesson.status === "published" ? "Locked" : "Edit lesson"}</button></div><WorkflowAction recordType="lesson" recordId={lesson.id} status={lesson.status} onTransition={transitionRecord} saving={saving} /></article>)}</div> : <p className="mt-3 text-sm text-ink/60">No lessons yet. Save the first lesson above.</p>}</div></section>}

        {step === "content" && <ContentStudioPanel lessons={selectedLessons} lessonId={lessonId || selectedLessons[0]?.id || ""} setLessonId={setLessonId} title={resourceTitle} setTitle={setResourceTitle} description={resourceDescription} setDescription={setResourceDescription} file={resourceFile} setFile={setResourceFile} onSubmit={uploadResource} saving={saving} />}

        {step === "assessment" && <AssessmentStudioPanel form={assessmentForm} setForm={setAssessmentForm} onSubmit={createAssessment} saving={saving} disabled={!courseId} assessment={assessments.find(item => item.id === assessmentId) ?? null} rulesForm={rulesForm} setRulesForm={setRulesForm} onSaveRules={saveAssessmentRules} onValidate={runReadiness} readiness={readiness} onTransition={(_recordType, recordId, targetStatus) => transitionRecord("assessment", recordId, targetStatus)} />}

        {step === "rules" && <StudioPanel eyebrow="Step 6" title="Points and completion" icon={<Target className="h-7 w-7 text-wine" />}><form onSubmit={saveProgrammeRules} className="grid gap-4 md:grid-cols-2"><Field label="Required activities" value={rulesForm.requiredActivities} onChange={value => setRulesForm(current => ({ ...current, requiredActivities: value }))} wide /><label className="grid gap-2 text-sm font-semibold">Minimum programme score<input value={rulesForm.minimumScore} onChange={event => setRulesForm(current => ({ ...current, minimumScore: event.target.value }))} type="number" min="0" max="100" className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Minimum examination score<input value={rulesForm.examinationScore} onChange={event => setRulesForm(current => ({ ...current, examinationScore: event.target.value }))} type="number" min="0" max="100" className="border border-wine/20 px-3 py-3 font-normal" /></label><button disabled={saving || !programmeId} className="button-primary w-fit"><Save className="h-4 w-4" />Save completion rules</button></form><Notice>Server validation remains authoritative. Course Studio shows the plan, while learner completion and certificate eligibility continue to be calculated by NIU’s existing protected functions.</Notice></StudioPanel>}
        {step === "certificate" && <StudioPanel eyebrow="Step 7" title="Certificate design" icon={<Target className="h-7 w-7 text-wine" />}><form onSubmit={saveProgrammeRules} className="grid gap-4 md:grid-cols-2"><Field label="Certificate template key" value={certificateForm.templateKey} onChange={value => setCertificateForm(current => ({ ...current, templateKey: value }))} /><Field label="University logo or approved reference" value={programmeForm.image} onChange={value => update(setProgrammeForm, "image", value)} /><Field label="President name" value={certificateForm.presidentName} onChange={value => setCertificateForm(current => ({ ...current, presidentName: value }))} /><Field label="Signature identifier" value={certificateForm.signatureIdentifier} onChange={value => setCertificateForm(current => ({ ...current, signatureIdentifier: value }))} /><div className="border border-gold/40 bg-gold/10 p-6 md:col-span-2"><h4 className="font-serif text-2xl">NIU certificate-only credential</h4><p className="mt-3 text-sm leading-6 text-ink/70">Student name · programme name · credential number · completion date · issue date · learning hours · final score · QR verification</p><p className="mt-3 text-sm font-bold text-wine">President and Founder: Akin S. Sokpah · Signature identifier: akinssokpah</p></div><button disabled={saving || !programmeId} className="button-primary w-fit"><Save className="h-4 w-4" />Save certificate settings</button></form>{certificateTemplateId && <WorkflowAction recordType="certificate_template" recordId={certificateTemplateId} status={certificateTemplateStatus} onTransition={transitionRecord} saving={saving} />}</StudioPanel>}
        {step === "preview" && <StudioPanel eyebrow="Step 8" title="Student preview" icon={<BookOpen className="h-7 w-7 text-wine" />}><p className="text-sm leading-6 text-ink/65">This preview is read-only. It reflects the selected course’s real records and never grants a learner access to draft materials.</p><div className="mt-5 grid gap-3">{modules.filter(item => item.course_id === courseId).map(item => <div key={item.id} className="border border-wine/10 bg-canvas p-4"><b>Module {item.position + 1}: {item.title}</b><p className="mt-1 text-sm text-ink/60">{lessons.filter(lesson => lesson.module_id === item.id).length} lessons · {item.learning_level}</p></div>)}</div></StudioPanel>}
        {step === "review" && <StudioPanel eyebrow="Step 9" title="Validation and publish" icon={<ClipboardCheck className="h-7 w-7 text-wine" />}><div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-wine/10 bg-canvas p-4"><div><p className="font-semibold">Live database validation</p><p className="text-sm text-ink/60">Counts only records linked to the selected programme package.</p></div><button type="button" onClick={() => void runReadiness()} disabled={saving || !programmeId} className="button-secondary">{saving ? "Validating…" : "Validate programme"}</button></div><div className="grid gap-3">{checks.map(item => <div key={item.label} className={`flex items-center gap-3 border p-4 ${item.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-wine/15 bg-wine/5 text-ink/75"}`}>{item.ok ? <Check className="h-5 w-5 text-emerald-700" /> : <AlertCircle className="h-5 w-5 text-wine" />}<span className="text-sm font-semibold">{item.label}</span><span className="ml-auto text-xs font-bold uppercase">{item.ok ? "Complete" : "Required review"}</span></div>)}</div><div className="mt-6 flex flex-wrap gap-3"><Link href="/programme-publication" className="button-primary">Open final publication gate <ArrowRight className="h-4 w-4" /></Link><Link href="/programme-package" className="button-secondary">View package readiness</Link></div><p className="mt-4 text-xs leading-5 text-ink/55">Course Studio does not bypass the existing publication gate. Critical missing materials, assessments, or review decisions must be resolved before publication.</p></StudioPanel>}
      </main>
      <aside className="grid content-start gap-5 lg:sticky lg:top-5 lg:h-fit"><section className="border border-wine/10 bg-white p-5"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-wine" /><p className="eyebrow">Progress checklist</p></div><p className="mt-3 font-serif text-3xl">{checks.filter(item => item.ok).length}/{checks.length}</p><p className="text-sm text-ink/60">gates currently complete</p><div className="mt-4 h-2 overflow-hidden bg-canvas"><div className="h-full bg-wine transition-all" style={{ width: `${Math.round((checks.filter(item => item.ok).length / checks.length) * 100)}%` }} /></div><div className="mt-5 grid gap-3">{checks.map(item => <div key={item.label} className="flex gap-2 text-xs leading-5"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.ok ? "bg-emerald-600" : "bg-wine/30"}`} /><span className={item.ok ? "text-ink/70" : "text-ink/50"}>{item.label}</span></div>)}</div></section><section className="border border-wine/10 bg-ink p-5 text-paper"><p className="eyebrow text-gold">Workspace guardrails</p><ul className="mt-4 grid gap-3 text-sm leading-6 text-paper/75"><li>Draft changes remain unpublished.</li><li>Protected materials stay in private object storage.</li><li>Relationships use real programme, course, module, and lesson records.</li><li>Final publishing remains reviewer-authorised and certificate-only.</li></ul></section></aside>
    </div></section>
  </SiteShell>;
}

function WorkflowAction({ recordType, recordId, status, onTransition, saving }: { recordType: "course" | "module" | "lesson" | "assessment" | "certificate_template"; recordId: string; status: string; onTransition: (recordType: "course" | "module" | "lesson" | "assessment" | "certificate_template", recordId: string, targetStatus: "review" | "approved") => Promise<void>; saving: boolean }) { const label = recordType.replace("_", " "); const approved = status === "approved" || status === "published"; const target = status === "draft" ? "review" : status === "review" ? "approved" : null; return <div className="my-5 flex flex-wrap items-center justify-between gap-3 border border-gold/40 bg-gold/10 p-4"><div><p className="text-sm font-bold">{label[0].toUpperCase() + label.slice(1)} status: {status}</p><p className="text-xs text-ink/60">Governed workflow: Draft → Review → Approved. Each transition is audited.</p></div>{approved ? <span className="text-sm font-bold text-emerald-800">Approved</span> : target ? <button type="button" disabled={saving} onClick={() => void onTransition(recordType, recordId, target)} className="button-secondary">{target === "review" ? "Submit for Review" : `Approve ${label}`}</button> : <span className="text-sm font-bold text-amber-800">Review required</span>}</div>; }

function Field({ label, value, onChange, wide = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean; disabled?: boolean }) { return <label className={`grid gap-2 text-sm font-semibold ${wide ? "md:col-span-2" : ""}`}>{label}<textarea value={value} disabled={disabled} onChange={event => onChange(event.target.value)} rows={wide ? 4 : 3} className="border border-wine/20 px-3 py-3 font-normal disabled:bg-canvas disabled:text-ink/45" /></label>; }
function Notice({ children }: { children: React.ReactNode }) { return <div className="mt-6 border border-wine/10 bg-canvas p-5 text-sm leading-6 text-ink/65">{children}</div>; }
function StudioPanel({ eyebrow, title, icon, children }: { eyebrow: string; title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="border border-wine/10 bg-white p-7"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-full bg-canvas">{icon}</div><div><p className="eyebrow">{eyebrow}</p><h3 className="mt-2 font-serif text-3xl">{title}</h3></div></div><div className="mt-7">{children}</div></section>; }
function StudioCards({ eyebrow, title, text, cards }: { eyebrow: string; title: string; text: string; cards: { icon: typeof FileText; title: string; text: string; href: string }[] }) { return <StudioPanel eyebrow={eyebrow} title={title} icon={<FileText className="h-7 w-7 text-wine" />}><p className="leading-7 text-ink/65">{text}</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{cards.map(item => <article key={item.title} className="border border-wine/10 bg-canvas p-5"><item.icon className="h-5 w-5 text-wine" /><h4 className="mt-4 font-serif text-xl">{item.title}</h4><p className="mt-2 text-sm leading-6 text-ink/65">{item.text}</p><Link href={item.href} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-wine">Open governed editor <ArrowRight className="h-4 w-4" /></Link></article>)}</div></StudioPanel>; }
function CurriculumTree({ courses, modules, lessons, courseId, moduleId, onCourse, onModule, onLesson }: { courses: Course[]; modules: Module[]; lessons: Lesson[]; courseId: string; moduleId: string; onCourse: (id: string) => void; onModule: (id: string) => void; onLesson: (id: string) => void }) { return <div className="mt-6 rounded-sm border border-wine/10 bg-canvas p-4"><p className="font-serif text-xl">Programme curriculum</p>{courses.length ? courses.map(course => <div key={course.id} className="mt-3"><button type="button" onClick={() => onCourse(course.id)} className={`flex w-full items-center gap-2 text-left font-bold ${courseId === course.id ? "text-wine" : "text-ink"}`}><ChevronRight className="h-4 w-4" />{course.title}<span className="ml-auto text-xs font-normal uppercase text-ink/50">{course.status}</span></button>{courseId === course.id && modules.filter(item => item.course_id === course.id).map(module => <div key={module.id} className="ml-6 mt-2 border-l border-wine/20 pl-4"><button type="button" onClick={() => onModule(module.id)} className={`flex w-full items-center gap-2 text-left text-sm font-bold ${moduleId === module.id ? "text-wine" : "text-ink/75"}`}><ChevronRight className="h-3 w-3" />Module {module.position + 1}: {module.title}<span className="ml-auto text-xs font-normal text-ink/45">{lessons.filter(item => item.module_id === module.id).length} lessons</span></button>{moduleId === module.id && lessons.filter(item => item.module_id === module.id).sort((a, b) => a.position - b.position).map(lesson => <button key={lesson.id} type="button" onClick={() => onLesson(lesson.id)} className="ml-5 mt-2 flex w-[calc(100%-1.25rem)] items-center gap-2 text-left text-xs text-ink/65"><FileText className="h-3 w-3 text-wine" />{lesson.position + 1}. {lesson.title}</button>)}</div>)}</div>) : <p className="mt-5 text-sm text-ink/60">No course is attached yet. Create the first course below.</p>}</div>; }
function CourseForm({ form, setForm, onSubmit, saving, disabled }: { form: CourseFormState; setForm: React.Dispatch<React.SetStateAction<CourseFormState>>; onSubmit: (event: React.FormEvent) => void; saving: boolean; disabled: boolean }) { return <form onSubmit={onSubmit} className="mt-7 grid gap-4 border-t border-wine/10 pt-6"><h4 className="font-serif text-2xl">Add course to this programme</h4><div className="grid gap-4 md:grid-cols-2"><Field label="Course title" value={form.title} onChange={value => setForm(current => ({ ...current, title: value }))} /><label className="grid gap-2 text-sm font-semibold">Difficulty<select value={form.level} onChange={event => setForm(current => ({ ...current, level: event.target.value }))} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><Field label="Description" value={form.description} onChange={value => setForm(current => ({ ...current, description: value }))} wide /><label className="grid gap-2 text-sm font-semibold">Learning minutes<input type="number" min="0" value={form.minutes} onChange={event => setForm(current => ({ ...current, minutes: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label><Field label="Category" value={form.category} onChange={value => setForm(current => ({ ...current, category: value }))} /><Field label="Learning outcomes" value={form.outcomes} onChange={value => setForm(current => ({ ...current, outcomes: value }))} /><Field label="Entry requirements" value={form.requirements} onChange={value => setForm(current => ({ ...current, requirements: value }))} /></div><button disabled={saving || disabled} className="button-primary w-fit"><Plus className="h-4 w-4" />{saving ? "Creating course…" : "Save course and continue"}</button></form>; }
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

function AssessmentStudioPanel({ form, setForm, onSubmit, saving, disabled, assessment, rulesForm, setRulesForm, onSaveRules, onValidate, readiness, onTransition }: { form: { title: string; type: string; passingScore: string; attempts: string; timeLimit: string; weight: string }; setForm: React.Dispatch<React.SetStateAction<{ title: string; type: string; passingScore: string; attempts: string; timeLimit: string; weight: string }>>; onSubmit: (event: React.FormEvent) => void; saving: boolean; disabled: boolean; assessment: Assessment | null; rulesForm: { requiredActivities: string; minimumScore: string; examinationScore: string }; setRulesForm: React.Dispatch<React.SetStateAction<{ requiredActivities: string; minimumScore: string; examinationScore: string }>>; onSaveRules: (event: React.FormEvent) => void; onValidate: () => Promise<void>; readiness: Readiness | null; onTransition: (recordType: "assessment", recordId: string, targetStatus: "review" | "approved") => Promise<void> }) {
  const missing = assessment ? [
    assessment.status === "approved" || assessment.status === "published" ? null : assessment.status === "review" ? null : "Submit the assessment for review",
    assessment.passing_score > 0 && assessment.passing_score <= 100 ? null : "Set a passing score between 1 and 100",
    assessment.attempt_limit && assessment.attempt_limit > 0 ? null : "Set a positive attempt limit",
    assessment.time_limit_minutes && assessment.time_limit_minutes > 0 ? null : "Set a positive time limit",
    assessment.required_completion_rules && Object.keys(assessment.required_completion_rules).length ? null : "Save completion rules",
    assessment.question_count > 0 ? null : "Attach at least one approved question",
    readiness?.ready_governed_assessments === readiness?.governed_assessments && readiness?.governed_assessments ? null : "Pass the programme readiness gate"
  ].filter((item): item is string => Boolean(item)) : [];
  return <StudioPanel eyebrow="Step 5" title="Assessments" icon={<ClipboardCheck className="h-7 w-7 text-wine" />}>
    <p className="leading-7 text-ink/65">Create a governed draft assessment, then complete its questions, completion rules, validation, and review workflow without leaving this workspace.</p>
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2"><Field label="Assessment title" value={form.title} onChange={value => setForm(current => ({ ...current, title: value }))} wide /><label className="grid gap-2 text-sm font-semibold">Assessment type<select value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value }))} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="knowledge_check">Knowledge check</option><option value="quiz">Quiz</option><option value="module_test">Module assessment</option><option value="final_assessment">Final assessment</option><option value="exam">Final examination</option></select></label><label className="grid gap-2 text-sm font-semibold">Passing score<input type="number" min="0" max="100" value={form.passingScore} onChange={event => setForm(current => ({ ...current, passingScore: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Attempt limit<input type="number" min="1" value={form.attempts} onChange={event => setForm(current => ({ ...current, attempts: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Time limit in minutes<input type="number" min="1" value={form.timeLimit} onChange={event => setForm(current => ({ ...current, timeLimit: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Weighted contribution<input type="number" min="0" max="100" value={form.weight} onChange={event => setForm(current => ({ ...current, weight: event.target.value }))} className="border border-wine/20 px-3 py-3 font-normal" /></label><button disabled={saving || disabled} className="button-primary w-fit"><Plus className="h-4 w-4" />{saving ? "Saving assessment…" : "Save draft assessment"}</button></form>
    {assessment && <section className="mt-7 grid gap-5 border-t border-wine/10 pt-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Saved assessment</p><h3 className="mt-2 font-serif text-3xl">{assessment.title}</h3><p className="mt-2 text-sm text-ink/60">{assessment.assessment_type.replace("_", " ")} · Status: <strong>{assessment.status}</strong></p></div><Link href={`/assessment-builder?assessmentId=${encodeURIComponent(assessment.id)}`} className="button-primary">Open Assessment Builder <ArrowRight className="h-4 w-4" /></Link></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Passing score", `${assessment.passing_score}%`],["Attempts", assessment.attempt_limit ?? "Not set"],["Time limit", assessment.time_limit_minutes ? `${assessment.time_limit_minutes} min` : "Not set"],["Question count", assessment.question_count],["Validation", readiness?.ready_governed_assessments === readiness?.governed_assessments && readiness?.governed_assessments ? "Ready" : "Needs work"]].map(([label,value]) => <div key={String(label)} className="border border-wine/10 bg-canvas p-3"><p className="text-xs uppercase tracking-[0.1em] text-ink/50">{label}</p><p className="mt-2 font-semibold">{value}</p></div>)}</div><form onSubmit={onSaveRules} className="grid gap-4 border border-wine/10 bg-canvas p-5 md:grid-cols-2"><h4 className="font-serif text-2xl md:col-span-2">Completion rules</h4><label className="grid gap-2 text-sm font-semibold md:col-span-2">Required activities<textarea value={rulesForm.requiredActivities} disabled={assessment.status === "approved" || assessment.status === "published"} onChange={event => setRulesForm(current => ({ ...current, requiredActivities: event.target.value }))} rows={4} className="border border-wine/20 px-3 py-3 font-normal disabled:bg-canvas disabled:text-ink/45" /></label><Field label="Minimum score" value={rulesForm.minimumScore} disabled={assessment.status === "approved" || assessment.status === "published"} onChange={value => setRulesForm(current => ({ ...current, minimumScore: value }))} /><Field label="Minimum examination score" value={rulesForm.examinationScore} disabled={assessment.status === "approved" || assessment.status === "published"} onChange={value => setRulesForm(current => ({ ...current, examinationScore: value }))} /><button disabled={saving || assessment.status === "approved" || assessment.status === "published"} className="button-secondary w-fit">Save completion rules</button></form><div className="border border-wine/10 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-serif text-2xl">Validation status</h4><p className="mt-1 text-sm text-ink/60">Every missing requirement is listed before review or approval.</p></div><button type="button" disabled={saving} onClick={() => void onValidate()} className="button-secondary">Refresh validation</button></div>{missing.length ? <ul className="mt-4 grid gap-2 text-sm text-wine">{missing.map(item => <li key={item}>• {item}</li>)}</ul> : <p className="mt-4 text-sm font-semibold text-emerald-800">All assessment requirements are complete.</p>}</div><WorkflowAction recordType="assessment" recordId={assessment.id} status={assessment.status} onTransition={(_recordType, recordId, targetStatus) => onTransition("assessment", recordId, targetStatus)} saving={saving} /></section>}
    <Notice><strong>Workflow status: {assessment?.status ?? "Draft"}.</strong> Saving never publishes or approves an assessment. Questions are managed in the existing Assessment Builder. Draft → Review → Approved is governed by NIU; approved assessments are locked.</Notice>
  </StudioPanel>;
}
