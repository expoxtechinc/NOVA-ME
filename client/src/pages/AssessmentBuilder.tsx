import { AlertCircle, BookOpenCheck, CheckCircle2, ClipboardList, LoaderCircle, Plus, Save, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import SiteShell from "@/components/SiteShell";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type Role = "student" | "instructor" | "registrar" | "administrator" | "super_admin";
type Status = "draft" | "review" | "approved" | "published" | "rejected" | "archived";
type Bank = { id: string; title: string; description: string | null; status: string };
type Choice = { id: string; text: string };
type Question = {
  id: string;
  question_bank_id: string;
  prompt: string;
  question_type: string;
  choices: Choice[];
  answer_key: { correct_choice_id?: string };
  explanation: string | null;
  difficulty: string;
  topic: string | null;
  category: string | null;
  learning_objective: string | null;
  points: number;
  approval_status: Status;
  requires_manual_grading: boolean;
};
type Assessment = { id: string; title: string; assessment_type: string; status: "draft" | "review" | "approved" | "published" | "archived" };

const emptyChoices: Choice[] = [{ id: "1", text: "" }, { id: "2", text: "" }];
const statuses: Status[] = ["draft", "review", "approved", "rejected", "archived"];

function normaliseChoices(value: unknown): Choice[] {
  if (!Array.isArray(value)) return [];
  return value.map((choice, index) => ({ id: String((choice as { id?: unknown })?.id ?? index + 1), text: String((choice as { text?: unknown })?.text ?? "") }));
}

export default function AssessmentBuilder() {
  const [role, setRole] = useState<Role | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [bankId, setBankId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [choices, setChoices] = useState<Choice[]>(emptyChoices);
  const [correctChoiceId, setCorrectChoiceId] = useState("1");
  const [questionType, setQuestionType] = useState("multiple_choice");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [topic, setTopic] = useState("");
  const [learningObjective, setLearningObjective] = useState("");
  const [points, setPoints] = useState("1");
  const [explanation, setExplanation] = useState("");
  const [newBankTitle, setNewBankTitle] = useState("");
  const [newBankDescription, setNewBankDescription] = useState("");
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankTitle, setBankTitle] = useState("");
  const [bankDescription, setBankDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [location] = useLocation();

  const staff = role === "instructor" || role === "registrar" || role === "administrator" || role === "super_admin";
  const canApprove = role === "registrar" || role === "administrator" || role === "super_admin";
  const visibleQuestions = useMemo(() => questions.filter((question) => !bankId || question.question_bank_id === bankId), [questions, bankId]);

  async function load() {
    const [bankResult, questionResult, assessmentResult] = await Promise.all([
      supabase.from("question_banks").select("id, title, description, status").order("created_at", { ascending: false }),
      supabase.from("questions").select("id, question_bank_id, prompt, question_type, choices, answer_key, explanation, difficulty, topic, category, learning_objective, points, approval_status, requires_manual_grading").order("created_at", { ascending: false }).limit(100),
      supabase.from("assessments").select("id, title, assessment_type, status").order("created_at", { ascending: false }).limit(50),
    ]);
    if (bankResult.error || questionResult.error || assessmentResult.error) setError("Question-bank records could not be loaded. Check your staff access and try again.");
    setBanks((bankResult.data ?? []) as Bank[]);
    setQuestions(((questionResult.data ?? []) as Array<Omit<Question, "choices" | "answer_key"> & { choices: unknown; answer_key: unknown }>).map((question) => ({ ...question, choices: normaliseChoices(question.choices), answer_key: (question.answer_key && typeof question.answer_key === "object" ? question.answer_key : {}) as Question["answer_key"] })));
    setAssessments((assessmentResult.data ?? []) as Assessment[]);
    const requestedAssessmentId = new URLSearchParams(location.split("?")[1] ?? "").get("assessmentId");
    if (requestedAssessmentId && (assessmentResult.data ?? []).some(item => item.id === requestedAssessmentId)) setAssessmentId(requestedAssessmentId);
  }

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    let active = true;
    async function bootstrap() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active || !sessionData.session) { setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", sessionData.session.user.id).maybeSingle();
      if (!active) return;
      setRole(profile?.role as Role ?? null);
      if (profile?.role && profile.role !== "student") await load();
      if (active) setLoading(false);
    }
    bootstrap();
    return () => { active = false; };
  }, [location]);

  function resetQuestionForm() {
    setEditingQuestionId(null); setPrompt(""); setChoices(emptyChoices); setCorrectChoiceId("1"); setQuestionType("multiple_choice"); setDifficulty("intermediate"); setTopic(""); setLearningObjective(""); setPoints("1"); setExplanation("");
  }

  function startEditingQuestion(question: Question) {
    setEditingQuestionId(question.id); setBankId(question.question_bank_id); setPrompt(question.prompt); setChoices(question.choices.length ? question.choices : emptyChoices); setCorrectChoiceId(question.answer_key.correct_choice_id ?? question.choices[0]?.id ?? "1"); setQuestionType(question.question_type); setDifficulty(question.difficulty); setTopic(question.topic ?? question.category ?? ""); setLearningObjective(question.learning_objective ?? ""); setPoints(String(question.points)); setExplanation(question.explanation ?? ""); setError(null); setMessage("Editing a saved draft question. Save changes when ready.");
  }

  function updateChoice(index: number, text: string) { setChoices((current) => current.map((choice, choiceIndex) => choiceIndex === index ? { ...choice, text } : choice)); }
  function addChoice() { setChoices((current) => [...current, { id: String(current.length + 1), text: "" }]); }
  function removeChoice(index: number) { setChoices((current) => current.length <= 2 ? current : current.filter((_, choiceIndex) => choiceIndex !== index).map((choice, choiceIndex) => ({ ...choice, id: String(choiceIndex + 1) }))); }

  async function saveBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(null);
    if (newBankTitle.trim().length < 2) { setError("Provide a question-bank title."); return; }
    setSaving(true);
    const { error: writeError } = await supabase.from("question_banks").insert({ title: newBankTitle.trim(), description: newBankDescription.trim() || null, status: "draft", governed_workflow: true });
    if (writeError) setError(writeError.message); else { setMessage("Draft question bank created. It remains private until governed staff review."); setNewBankTitle(""); setNewBankDescription(""); await load(); }
    setSaving(false);
  }

  async function saveBankEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingBankId || bankTitle.trim().length < 2) return;
    setSaving(true); setError(null); setMessage(null);
    const { error: writeError } = await supabase.from("question_banks").update({ title: bankTitle.trim(), description: bankDescription.trim() || null }).eq("id", editingBankId);
    if (writeError) setError(writeError.message); else { setMessage("Question-bank details saved."); setEditingBankId(null); await load(); }
    setSaving(false);
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(null);
    if (!bankId || prompt.trim().length < 2) { setError("Choose a bank and provide a question prompt."); return; }
    const cleanedChoices = choices.map((choice, index) => ({ id: String(index + 1), text: choice.text.trim() })).filter((choice) => choice.text);
    if (questionType === "multiple_choice" && cleanedChoices.length < 2) { setError("Multiple-choice questions require at least two answer choices."); return; }
    const selectedCorrect = questionType === "multiple_choice" || questionType === "true_false" ? (cleanedChoices.some((choice) => choice.id === correctChoiceId) ? correctChoiceId : cleanedChoices[0]?.id) : undefined;
    if ((questionType === "multiple_choice" || questionType === "true_false") && !selectedCorrect) { setError("Select the correct answer before saving."); return; }
    const payload = { question_bank_id: bankId, question_type: questionType, prompt: prompt.trim(), choices: cleanedChoices, answer_key: selectedCorrect ? { correct_choice_id: selectedCorrect } : {}, explanation: explanation.trim() || null, difficulty, topic: topic.trim() || null, learning_objective: learningObjective.trim() || null, points: Number(points), requires_manual_grading: ["essay", "short_answer", "scenario"].includes(questionType), governed_workflow: true };
    if (payload.points <= 0 || !Number.isFinite(payload.points)) { setError("Question points must be greater than zero."); return; }
    setSaving(true);
    const result = editingQuestionId ? await supabase.from("questions").update(payload).eq("id", editingQuestionId) : await supabase.from("questions").insert({ ...payload, approval_status: "draft" });
    if (result.error) setError(result.error.message); else { setMessage(editingQuestionId ? "Question changes saved as a private draft. Re-approval is required for approved questions." : "Question saved as a private draft. Submit it for governed review when ready."); resetQuestionForm(); await load(); }
    setSaving(false);
  }

  async function updateQuestionStatus(question: Question, status: Status) {
    if (status !== "review" && status !== "approved") { setError("Questions must use the governed Draft → Review → Approved workflow."); return; }
    if (status === "approved" && !canApprove) { setError("Only an administrator, registrar, or Super Administrator may approve questions."); return; }
    setSaving(true); setError(null); setMessage(null);
    const { error: writeError } = await supabase.rpc("niu_transition_academic_record", { target_type: "question", target_id: question.id, target_status: status });
    if (writeError) setError(`Question could not move to ${status}: ${writeError.message}`); else { setMessage(`Question is now ${status}.`); await load(); }
    setSaving(false);
  }

  async function updateAssessmentStatus(assessment: Assessment, status: Assessment["status"]) {
    if (status === "approved" || status === "published" || status === "archived") {
      if (!canApprove) { setError("Only an administrator, registrar, or Super Administrator may approve, publish, or archive an assessment."); return; }
    }
    setSaving(true); setError(null); setMessage(null);
    if (status === "draft" || status === "published" || status === "archived" || (status === "approved" && assessment.status !== "review")) { setError("Assessment status changes must use Draft → Review → Approved. Approved assessments are locked."); setSaving(false); return; }
    const { error: writeError } = await supabase.rpc("niu_transition_academic_record", { target_type: "assessment", target_id: assessment.id, target_status: status });
    if (writeError) setError(writeError.message.includes("publication") || writeError.message.includes("requires") ? writeError.message : `Assessment could not move to ${status}. Check its validation requirements and try again.`);
    else { setMessage(`Assessment moved to ${status}. NIU recorded the governed status action in the audit history.`); await load(); }
    setSaving(false);
  }

  async function attachQuestion(question: Question) {
    if (!assessmentId) { setError("Choose an assessment before attaching an approved question."); return; }
    if (question.approval_status !== "approved") { setError("Only approved questions may be attached to assessments."); return; }
    setSaving(true); setError(null); setMessage(null);
    const { data: positions } = await supabase.from("assessment_questions").select("position").eq("assessment_id", assessmentId).order("position", { ascending: false }).limit(1);
    const position = Number(positions?.[0]?.position ?? -1) + 1;
    const { error: writeError } = await supabase.from("assessment_questions").upsert({ assessment_id: assessmentId, question_id: question.id, position }, { onConflict: "assessment_id,question_id" });
    if (writeError) setError(`Question could not be attached: ${writeError.message}`); else { setMessage("Approved question attached to the selected assessment sequence."); await load(); }
    setSaving(false);
  }

  if (loading) return <SiteShell><div className="mx-auto flex min-h-[55vh] flex-col items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-wine" /><p className="mt-4 text-sm text-ink/60">Loading academic authoring…</p></div></SiteShell>;
  if (!staff) return <SiteShell><section className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-5 text-center"><ShieldAlert className="h-10 w-10 text-wine" /><h1 className="mt-5 font-serif text-4xl">Academic staff authority required.</h1><Link href={role ? "/portal" : "/signin"} className="button-primary mt-7">{role ? "Return to My NIU" : "Sign in to NIU"}</Link></section></SiteShell>;

  return <SiteShell>
    <section className="border-b border-wine/10 bg-canvas"><div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12"><p className="eyebrow">Question Bank</p><h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Govern reusable assessment questions.</h1><p className="mt-3 max-w-3xl leading-7 text-ink/65">Create private question banks, author and review saved questions, and attach only approved questions to assessments. Existing curriculum and assessment records remain unchanged until an authorised staff member performs an explicit action.</p></div></section>
    <section className="mx-auto grid max-w-[1440px] gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:px-12">
      <div className="grid content-start gap-6">
        <form onSubmit={saveBank} className="border border-wine/10 bg-white p-6"><BookOpenCheck className="h-6 w-6 text-wine" /><h2 className="mt-4 font-serif text-2xl">Create Question Bank</h2><p className="mt-2 text-sm leading-6 text-ink/60">Start an empty private bank. No questions or assessments are created automatically.</p><label className="mt-5 grid gap-2 text-sm font-semibold">Title<input value={newBankTitle} onChange={(event) => setNewBankTitle(event.target.value)} placeholder="e.g. Digital literacy knowledge checks" className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="mt-4 grid gap-2 text-sm font-semibold">Description<textarea value={newBankDescription} onChange={(event) => setNewBankDescription(event.target.value)} rows={3} placeholder="Purpose and review scope" className="border border-wine/20 px-3 py-3 font-normal" /></label><button disabled={saving} className="button-primary mt-5 inline-flex w-full items-center justify-center gap-2 disabled:opacity-60"><Plus className="h-4 w-4" />Create Question Bank</button></form>
        <section className="border border-wine/10 bg-white p-6"><ClipboardList className="h-6 w-6 text-wine" /><h2 className="mt-4 font-serif text-2xl">Question banks</h2>{banks.length === 0 ? <div className="mt-5 border border-dashed border-wine/20 bg-canvas p-5 text-sm leading-6 text-ink/65">No question banks exist yet. Create an empty bank above, then add questions one at a time for academic review.</div> : <div className="mt-5 grid gap-3">{banks.map((bank) => <article key={bank.id} className={`border p-4 ${bank.id === bankId ? "border-wine bg-wine/[.04]" : "border-wine/10"}`}><div className="flex flex-wrap items-start justify-between gap-3"><button type="button" onClick={() => setBankId(bank.id)} className="text-left"><p className="font-semibold">{bank.title}</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-ink/50">{bank.status} · {questions.filter((question) => question.question_bank_id === bank.id).length} saved</p></button><button type="button" onClick={() => { setEditingBankId(bank.id); setBankTitle(bank.title); setBankDescription(bank.description ?? ""); }} className="button-secondary text-xs">Edit bank</button></div>{editingBankId === bank.id && <form onSubmit={saveBankEdits} className="mt-4 grid gap-3 border-t border-wine/10 pt-4"><input value={bankTitle} onChange={(event) => setBankTitle(event.target.value)} className="border border-wine/20 px-3 py-2 text-sm" aria-label="Question bank title" /><textarea value={bankDescription} onChange={(event) => setBankDescription(event.target.value)} rows={2} className="border border-wine/20 px-3 py-2 text-sm" aria-label="Question bank description" /><div className="flex gap-2"><button disabled={saving} className="button-primary inline-flex items-center gap-2 text-sm"><Save className="h-4 w-4" />Save</button><button type="button" onClick={() => setEditingBankId(null)} className="button-secondary text-sm">Cancel</button></div></form>}</article>)}</div>}</section>
        <section className="border border-wine/10 bg-white p-6"><ClipboardList className="h-6 w-6 text-wine" /><h2 className="mt-4 font-serif text-2xl">Assessment state</h2>{assessments.length === 0 ? <div className="mt-5 border border-dashed border-wine/20 bg-canvas p-5 text-sm leading-6 text-ink/65">No assessments are available. Create and govern an assessment in Academic Tools first; this workspace will not create one for you.</div> : <div className="mt-5 grid gap-3">{assessments.map((assessment) => <div key={assessment.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-wine/10 pt-3"><div><p className="font-semibold">{assessment.title}</p><p className="mt-1 text-xs capitalize text-ink/55">{assessment.assessment_type.replace("_", " ")} · {assessment.status}</p></div><select value={assessment.status} disabled={saving} onChange={(event) => void updateAssessmentStatus(assessment, event.target.value as Assessment["status"])} className="border border-wine/20 bg-white px-2 py-2 text-sm" aria-label={`Status for ${assessment.title}`}><option value={assessment.status}>{assessment.status}</option>{assessment.status === "draft" && <option value="review">Submit for Review</option>}{assessment.status === "review" && <option value="approved">Approve</option>}</select></div>)}</div>}</section>
      </div>
      <div className="grid content-start gap-6">
        <form onSubmit={saveQuestion} className="border border-wine/10 bg-white p-6"><BookOpenCheck className="h-6 w-6 text-wine" /><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="mt-4 font-serif text-2xl">{editingQuestionId ? "Edit saved question" : "Create question"}</h2><p className="mt-2 text-sm leading-6 text-ink/60">New and edited questions remain private drafts until governed approval.</p></div>{editingQuestionId && <button type="button" onClick={resetQuestionForm} className="button-secondary mt-3 text-sm">New question</button>}</div>{(error || message) && <div className={`mt-4 flex gap-3 border-l-4 p-4 text-sm ${error ? "border-wine bg-wine/5" : "border-emerald-700 bg-emerald-50 text-emerald-900"}`}><AlertCircle className={`h-5 w-5 shrink-0 ${error ? "text-wine" : "text-emerald-700"}`} />{error ?? message}</div>}<label className="mt-5 grid gap-2 text-sm font-semibold">Choose a bank<select value={bankId} onChange={(event) => setBankId(event.target.value)} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="">Choose a bank</option>{banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.title} · {bank.status}</option>)}</select></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Question type<select value={questionType} onChange={(event) => { setQuestionType(event.target.value); if (event.target.value === "true_false") setChoices([{ id: "1", text: "True" }, { id: "2", text: "False" }]); }} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="multiple_choice">Multiple choice</option><option value="true_false">True / false</option><option value="short_answer">Short answer</option><option value="essay">Essay</option><option value="scenario">Scenario</option></select></label><label className="grid gap-2 text-sm font-semibold">Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div><label className="mt-4 grid gap-2 text-sm font-semibold">Question prompt<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} className="border border-wine/20 px-3 py-3 font-normal" /></label><div className="mt-4 grid gap-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Answer choices and correct answer</p>{questionType === "multiple_choice" && <button type="button" onClick={addChoice} className="button-secondary text-xs">Add choice</button>}</div>{questionType === "essay" || questionType === "short_answer" || questionType === "scenario" ? <p className="border border-dashed border-wine/20 bg-canvas p-4 text-sm leading-6 text-ink/60">This response type is manually graded. Add a clear rubric or explanation below; no multiple-choice answer key is required.</p> : choices.map((choice, index) => <div key={choice.id} className="flex items-center gap-2"><input type="radio" name="correct-choice" checked={correctChoiceId === choice.id} onChange={() => setCorrectChoiceId(choice.id)} aria-label={`Mark choice ${index + 1} correct`} /><input value={choice.text} onChange={(event) => updateChoice(index, event.target.value)} placeholder={`Choice ${index + 1}`} className="min-w-0 flex-1 border border-wine/20 px-3 py-2 text-sm" /><button type="button" onClick={() => removeChoice(index)} className="text-xs text-wine disabled:opacity-40" disabled={choices.length <= 2 || questionType === "true_false"}>Remove</button></div>)}</div><div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="grid gap-2 text-sm font-semibold">Topic<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. privacy" className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Learning objective<input value={learningObjective} onChange={(event) => setLearningObjective(event.target.value)} placeholder="Mapped objective" className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Points<input type="number" min="0.1" step="0.1" value={points} onChange={(event) => setPoints(event.target.value)} className="border border-wine/20 px-3 py-3 font-normal" /></label></div><label className="mt-4 grid gap-2 text-sm font-semibold">Explanation or grading guidance<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={3} className="border border-wine/20 px-3 py-3 font-normal" /></label><button disabled={saving || !banks.length} className="button-primary mt-5 inline-flex w-full items-center justify-center gap-2 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Saving…" : editingQuestionId ? "Save question changes" : "Save private draft question"}</button></form>
        <section className="border border-wine/10 bg-white p-6"><CheckCircle2 className="h-6 w-6 text-wine" /><h2 className="mt-4 font-serif text-2xl">Saved questions</h2><label className="mt-5 grid gap-2 text-sm font-semibold">Filter by bank<select value={bankId} onChange={(event) => setBankId(event.target.value)} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="">All banks</option>{banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.title}</option>)}</select></label>{visibleQuestions.length === 0 ? <div className="mt-6 border border-dashed border-wine/20 bg-canvas p-6 text-center text-sm leading-6 text-ink/65">No saved questions match this bank. Create a private draft above, then review its metadata and answer key before requesting approval.</div> : <div className="mt-6 divide-y divide-wine/10">{visibleQuestions.map((question) => <article key={question.id} className="py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-wine">{question.question_type.replace("_", " ")} · {question.difficulty} · {question.points} points</p><p className="mt-2 text-sm leading-6 text-ink/75">{question.prompt}</p><p className="mt-2 text-xs text-ink/55">{question.topic || "No topic"} · {question.learning_objective || "No learning objective mapped"}</p></div><span className={`border px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${question.approval_status === "approved" ? "border-emerald-700/30 bg-emerald-50 text-emerald-800" : "border-wine/15 bg-canvas text-ink/60"}`}>{question.approval_status}</span></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => startEditingQuestion(question)} disabled={saving} className="button-secondary text-sm">Edit</button><select value={question.approval_status} disabled={saving || (!canApprove && question.approval_status === "approved")} onChange={(event) => updateQuestionStatus(question, event.target.value as Status)} className="border border-wine/20 bg-white px-3 py-2 text-sm" aria-label={`Approval status for ${question.prompt.slice(0, 30)}`}><option value={question.approval_status}>{question.approval_status}</option>{question.approval_status === "draft" && <option value="review">Submit for Review</option>}{question.approval_status === "review" && canApprove && <option value="approved">Approve</option>}</select></div></article>)}</div>}</section>
        <section className="border border-wine/10 bg-white p-6"><ClipboardList className="h-6 w-6 text-wine" /><h2 className="mt-4 font-serif text-2xl">Attach saved questions</h2><p className="mt-2 text-sm leading-6 text-ink/60">Only approved questions are eligible for assessment attachment.</p><label className="mt-5 grid gap-2 text-sm font-semibold">Choose assessment<select value={assessmentId} onChange={(event) => setAssessmentId(event.target.value)} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="">Choose an assessment</option>{assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title}</option>)}</select></label><div className="mt-6 divide-y divide-wine/10">{visibleQuestions.filter((question) => question.approval_status === "approved").length === 0 ? <div className="border border-dashed border-wine/20 bg-canvas p-6 text-center text-sm leading-6 text-ink/65">No approved questions are ready to attach. Move a complete draft through review and have an authorised administrator approve it first.</div> : visibleQuestions.filter((question) => question.approval_status === "approved").map((question) => <article key={question.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Approved · {question.points} points</p><p className="mt-2 text-sm leading-6 text-ink/75">{question.prompt}</p></div><button disabled={saving || !assessmentId} onClick={() => attachQuestion(question)} className="button-secondary shrink-0">Attach saved question</button></article>)}</div></section>
      </div>
    </section>
  </SiteShell>;
}
