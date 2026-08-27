import { AlertCircle, FileUp, Link2, LoaderCircle, Paperclip, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import SiteShell from "@/components/SiteShell";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type Role = "student" | "instructor" | "administrator" | "super_admin";
type Item = { id: string; title: string; category: string; file_name: string; description: string | null; created_at: string };
type Lesson = { id: string; title: string };
type UploadCategory = "document" | "presentation" | "image" | "audio" | "video" | "research" | "study_guide";

const uploadCategories: UploadCategory[] = ["document", "presentation", "image", "audio", "video", "research", "study_guide"];
const storageBucket = "niu-learning-materials";
const maxBytes = 10 * 1024 * 1024;
const categoryMimeTypes: Record<UploadCategory, readonly string[]> = {
  document: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"],
  presentation: ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
  video: ["video/mp4", "video/webm"],
  research: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"],
  study_guide: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"],
};
const starterGuideTitle = "Digital Foundations: Access, Information, and Responsible Study";
const starterGuideFilename = "niu-digital-foundations-study-guide.md";
const starterGuide = `# Digital Foundations: Access, Information, and Responsible Study

> Draft teaching material—academic review required before publishing.

## Purpose

This original NIU draft study guide supports the first module of **Digital Foundations for Enterprise and Remote Work**. It helps learners establish inclusive, organised, and responsible study habits before using collaboration tools or planning a project. It is a learning resource for a certificate-only programme. It is not professional advice, a licence, or a guarantee of employment.

## Before you begin

You should have a device that can use a modern web browser, a working email address, and a regular place to save study notes. If your connection is limited, download permitted materials when you have reliable access and work through them offline where possible. Contact NIU support if you need a reasonable adjustment or an accessible alternative.

## 1. Protect your learning account

Use a unique, memorable passphrase for each important account. Do not share sign-in links, passwords, or verification codes with anyone. Sign out of shared devices when you finish studying, and keep your browser and device software updated. If you suspect someone else has accessed an account, change the password using the provider’s official recovery process and inform NIU support if your learning account may be affected.

## 2. Organise your digital workspace

Create one clearly named folder for this course. Keep separate subfolders for notes, downloaded readings, activities, and submitted work. Use meaningful names such as \`module-1-information-checklist.md\` rather than \`new-file-final2.docx\`. Add the date when it helps you find the latest version. A simple, consistent system reduces the chance of sharing the wrong file or losing evidence of your learning.

## 3. Check information before you use it

Before relying on information online, pause and ask four questions:

1. **Who created it?** Look for an identifiable author, organisation, or source.
2. **Why was it made?** Consider whether it aims to inform, sell, persuade, entertain, or mislead.
3. **When was it published or updated?** Older information may no longer fit the task.
4. **Can it be checked elsewhere?** Compare important claims with independent, credible sources.

Record the link, author, publication date, and a short note about why you considered the source useful. Do not copy work without acknowledgement. When a task requires sources, follow the citation method provided by NIU.

## 4. Work respectfully with others

Remote collaboration works best when people communicate clearly and respectfully. Use short subject lines, explain the purpose of a message, and state the action or deadline. Do not post another person’s private information, images, work, or contact details without permission. Assume that written messages can be misunderstood: choose respectful language, avoid unnecessary urgency, and ask a clear question when something is unclear.

## 5. Make learning accessible and sustainable

Use captions or transcripts when they are available. Break longer study sessions into shorter focused periods, take regular breaks, and use a format that helps you learn—such as notes, audio review, or a checklist. Tell NIU when a learning barrier affects your ability to participate so that support can be considered early.

## First learning activity

Create a private one-page study plan. Include: the device and connection you will use; where you will store your course work; one habit that protects your account; one method you will use to check information; and one support or accessibility adjustment that would help you learn. Keep this plan for reflection; do not publish personal details in a shared space.

## Reflection

At the end of this module, briefly record what changed in your study practice. What is one digital habit you will keep? What is one question you still have? These notes can help you prepare for the next module on collaborative remote work.

## Source and use note

This is original NIU draft teaching material written for this course structure. It does not reproduce third-party course content. Academic review is required before any authorised programme publication.
`;

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "").slice(0, 180) || "learning-resource";
}

function storagePath(userId: string, fileName: string) {
  return `${userId}/${crypto.randomUUID()}-${safeFilename(fileName)}`;
}

function errorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

export default function ContentLibrary() {
  const [role, setRole] = useState<Role | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<UploadCategory>("document");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [attachLessonId, setAttachLessonId] = useState("");
  const [attachItemId, setAttachItemId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const staff = role === "instructor" || role === "administrator" || role === "super_admin";

  async function load() {
    const [itemsResult, lessonsResult] = await Promise.all([
      supabase.from("content_library_items").select("id,title,category,file_name,description,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("lessons").select("id,title").order("title"),
    ]);
    if (itemsResult.error || lessonsResult.error) setError("NIU could not load the protected content-library records.");
    setItems((itemsResult.data ?? []) as Item[]);
    setLessons((lessonsResult.data ?? []) as Lesson[]);
  }

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    let active = true;
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active || !sessionData.session) { setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", sessionData.session.user.id).maybeSingle();
      if (!active) return;
      setRole(profile?.role as Role ?? null);
      if (profile && profile.role !== "student") await load();
      if (active) setLoading(false);
    }
    void init();
    return () => { active = false; };
  }, []);

  async function attachItem(lessonId: string, contentItemId: string) {
    const { data: existing, error: existingError } = await supabase.from("lesson_content_items").select("lesson_id").eq("lesson_id", lessonId).eq("content_item_id", contentItemId).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) return;
    const { data: current, error: positionError } = await supabase.from("lesson_content_items").select("position").eq("lesson_id", lessonId).order("position", { ascending: false }).limit(1);
    if (positionError) throw new Error(positionError.message);
    const { error: attachError } = await supabase.from("lesson_content_items").insert({ lesson_id: lessonId, content_item_id: contentItemId, is_required: true, position: Number(current?.[0]?.position ?? -1) + 1 });
    if (attachError) throw new Error(attachError.message);
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null); setError(null);
    if (!title.trim() || !selectedFile) { setError("Provide a resource title and choose a file."); return; }
    if (selectedFile.size > maxBytes) { setError("Learning resources must be 10 MB or smaller."); return; }
    if (!categoryMimeTypes[category].includes(selectedFile.type)) { setError("This file type is not supported for the selected content category."); return; }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("Sign in to NIU before uploading learning resources.");
      const fileName = safeFilename(selectedFile.name);
      const path = storagePath(user.id, fileName);
      const { error: storageError } = await supabase.storage.from(storageBucket).upload(path, selectedFile, { contentType: selectedFile.type || "application/octet-stream", upsert: false });
      if (storageError) throw new Error(storageError.message);
      const { error: recordError } = await supabase.from("content_library_items").insert({ title: title.trim(), category, file_name: fileName, content_type: selectedFile.type || "application/octet-stream", storage_path: path, description: description.trim() || null, created_by: user.id });
      if (recordError) throw new Error(recordError.message);
      setMessage("Learning resource securely added to NIU’s private content library.");
      setTitle(""); setDescription(""); setSelectedFile(null); await load();
    } catch (caught) { setError(errorMessage(caught as { message?: string }, "NIU could not upload this learning resource.")); }
    finally { setSaving(false); }
  }

  async function initializeDigitalStudyGuide() {
    if (!window.confirm("Add NIU’s original Digital Foundations study guide to the private library and attach it to the first draft lesson? It will not publish the guide or course.")) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("Sign in to NIU before creating the protected study guide.");
      const { data: course, error: courseError } = await supabase.from("courses").select("id").eq("slug", "digital-foundations-enterprise-remote-work").maybeSingle();
      if (courseError || !course) throw new Error("NIU’s starter programme structure is not available yet.");
      const { data: module, error: moduleError } = await supabase.from("course_modules").select("id").eq("course_id", course.id).eq("position", 0).maybeSingle();
      if (moduleError || !module) throw new Error("NIU’s starter module outline is not available yet.");
      const { data: lesson, error: lessonError } = await supabase.from("lessons").select("id").eq("module_id", module.id).eq("position", 0).maybeSingle();
      if (lessonError || !lesson) throw new Error("NIU’s starter lesson scaffold is not available yet.");
      const { data: existing, error: existingError } = await supabase.from("content_library_items").select("id").eq("title", starterGuideTitle).eq("file_name", starterGuideFilename).maybeSingle();
      if (existingError) throw new Error(existingError.message);
      let contentItemId = existing?.id;
      if (!contentItemId) {
        const path = storagePath(user.id, starterGuideFilename);
        const guideFile = new File([starterGuide], starterGuideFilename, { type: "text/markdown" });
        const { error: storageError } = await supabase.storage.from(storageBucket).upload(path, guideFile, { contentType: "text/markdown", upsert: false });
        if (storageError) throw new Error(storageError.message);
        const { data: created, error: recordError } = await supabase.from("content_library_items").insert({ title: starterGuideTitle, category: "study_guide", file_name: starterGuideFilename, content_type: "text/markdown", storage_path: path, description: "Original NIU draft study guide for the first Digital Foundations module. It remains private until an authorised programme release.", created_by: user.id }).select("id").single();
        if (recordError || !created) throw new Error(errorMessage(recordError, "NIU could not register the protected study guide."));
        contentItemId = created.id;
      }
      await attachItem(lesson.id, contentItemId);
      const { error: auditError } = await supabase.rpc("niu_record_digital_starter_study_guide_audit", { target_lesson_id: lesson.id, target_content_item_id: contentItemId });
      if (auditError) throw new Error("The NIU study guide was stored but its required audit record could not be confirmed. Please retry before relying on this setup.");
      setMessage("NIU’s original study guide is private, attached to the first draft lesson, and ready for authorised review.");
      await load();
    } catch (caught) { setError(errorMessage(caught as { message?: string }, "NIU could not add the protected study guide.")); }
    finally { setSaving(false); }
  }

  async function addExternal(event: React.FormEvent) {
    event.preventDefault(); setMessage(null); setError(null);
    let url: URL;
    try { url = new URL(externalUrl.trim()); } catch { setError("Enter a complete https:// external resource URL."); return; }
    if (url.protocol !== "https:" || title.trim().length < 3) { setError("Provide a title and an https:// external resource URL."); return; }
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const { error: insertError } = await supabase.from("content_library_items").insert({ title: title.trim(), category: "external_resource", file_name: url.hostname, content_type: "text/uri-list", storage_path: url.toString(), description: description.trim() || null, created_by: sessionData.session?.user.id });
    if (insertError) setError(insertError.message); else { setMessage("External learning resource added to the protected NIU library record."); setTitle(""); setDescription(""); setExternalUrl(""); await load(); }
    setSaving(false);
  }

  async function attach(event: React.FormEvent) {
    event.preventDefault(); setMessage(null); setError(null);
    if (!attachLessonId || !attachItemId) { setError("Choose a lesson and a content-library item to attach."); return; }
    setSaving(true);
    try { await attachItem(attachLessonId, attachItemId); setMessage("Learning resource attached to the selected lesson."); setAttachItemId(""); }
    catch (caught) { setError(errorMessage(caught as { message?: string }, "NIU could not attach this learning resource.")); }
    finally { setSaving(false); }
  }

  if (loading) return <SiteShell><div className="grid min-h-[55vh] place-items-center"><LoaderCircle className="h-8 w-8 animate-spin text-wine" /></div></SiteShell>;
  if (!staff) return <SiteShell><section className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-5 text-center"><ShieldAlert className="h-10 w-10 text-wine" /><h1 className="mt-5 font-serif text-4xl">Academic staff authority required.</h1><p className="mt-3 leading-7 text-ink/65">NIU only allows protected content-library administration for authorised institutional roles.</p><Link href={role ? "/portal" : "/signin"} className="button-primary mt-7">{role ? "Return to My NIU" : "Sign in to NIU"}</Link></section></SiteShell>;

  return <SiteShell><section className="border-b border-wine/10 bg-canvas"><div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8"><p className="eyebrow">Content library</p><h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Govern reusable learning materials.</h1><p className="mt-3 max-w-3xl leading-7 text-ink/65">Upload supported teaching resources once, attach them to authorised lessons, and preserve enrolled-only delivery. Files remain private in NIU object storage; external resources are explicitly labelled and require an https address.</p></div></section><section className="mx-auto grid max-w-[1200px] gap-7 px-5 py-12 sm:px-8 lg:grid-cols-2">{(message || error) && <p className={`lg:col-span-2 flex gap-2 border-l-4 p-4 text-sm ${error ? "border-wine bg-wine/5" : "border-emerald-700 bg-emerald-50 text-emerald-900"}`}><AlertCircle className="h-5 w-5 shrink-0" />{error ?? message}</p>}{role === "super_admin" && <section className="lg:col-span-2 border border-gold/40 bg-gold/10 p-6"><p className="text-sm font-bold text-wine">NIU original starter guide</p><h2 className="mt-2 font-serif text-3xl">Add the first protected study guide</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-ink/75">Create NIU’s original Digital Foundations study guide, store it privately, and attach it to the first draft lesson. It stays unpublished and does not create learners, assessments, or public content.</p><button type="button" onClick={initializeDigitalStudyGuide} disabled={saving} className="button-primary mt-5">{saving ? "Adding study guide…" : "Add NIU draft study guide"}</button></section>}<form onSubmit={upload} className="border border-wine/10 bg-white p-7 shadow-[0_16px_36px_rgba(29,25,21,0.05)]"><FileUp className="h-6 w-6 text-wine" /><h2 className="mt-4 font-serif text-3xl">Upload a learning resource</h2><p className="mt-2 text-sm leading-6 text-ink/60">PDF, DOC/DOCX, PPT/PPTX, approved images, audio, video, text, Markdown, research material, and study guides are categorised before storage. Maximum file size: 10 MB.</p><label className="mt-5 grid gap-2 text-sm font-semibold">Title<input value={title} onChange={event => setTitle(event.target.value)} className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="mt-4 grid gap-2 text-sm font-semibold">Category<select value={category} onChange={event => setCategory(event.target.value as UploadCategory)} className="border border-wine/20 bg-white px-3 py-3 font-normal">{uploadCategories.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><label className="mt-4 grid gap-2 text-sm font-semibold">Description<label className="sr-only">Description</label><textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="mt-4 grid gap-2 text-sm font-semibold">File<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg,.mp4,.webm" onChange={event => setSelectedFile(event.target.files?.[0] ?? null)} className="border border-wine/20 bg-white px-3 py-3 font-normal" /></label><button disabled={saving} className="button-primary mt-6">{saving ? "Uploading…" : "Add to protected library"}</button></form><div className="grid gap-7"><form onSubmit={addExternal} className="border border-wine/10 bg-white p-7"><Link2 className="h-6 w-6 text-wine" /><h2 className="mt-4 font-serif text-3xl">Register an external resource</h2><p className="mt-2 text-sm leading-6 text-ink/60">Use only links you are authorised to share. NIU records the reference; it does not claim ownership of external content.</p><label className="mt-5 grid gap-2 text-sm font-semibold">Title<input value={title} onChange={event => setTitle(event.target.value)} className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="mt-4 grid gap-2 text-sm font-semibold">HTTPS URL<input type="url" value={externalUrl} onChange={event => setExternalUrl(event.target.value)} placeholder="https://" className="border border-wine/20 px-3 py-3 font-normal" /></label><label className="mt-4 grid gap-2 text-sm font-semibold">Description<textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} className="border border-wine/20 px-3 py-3 font-normal" /></label><button disabled={saving} className="button-secondary mt-5">Save external resource</button></form><form onSubmit={attach} className="border border-wine/10 bg-canvas p-7"><Paperclip className="h-6 w-6 text-wine" /><h2 className="mt-4 font-serif text-3xl">Attach to a lesson</h2><label className="mt-5 grid gap-2 text-sm font-semibold">Lesson<select value={attachLessonId} onChange={event => setAttachLessonId(event.target.value)} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="">Choose a lesson</option>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label><label className="mt-4 grid gap-2 text-sm font-semibold">Library item<select value={attachItemId} onChange={event => setAttachItemId(event.target.value)} className="border border-wine/20 bg-white px-3 py-3 font-normal"><option value="">Choose a resource</option>{items.map(item => <option key={item.id} value={item.id}>{item.title} · {item.category}</option>)}</select></label><button disabled={saving} className="button-primary mt-5">{saving ? "Attaching…" : "Attach resource"}</button></form></div><section className="lg:col-span-2 border border-wine/10 bg-white p-7"><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">NIU library records</p><h2 className="mt-2 font-serif text-3xl">Approved content inventory</h2></div><p className="text-sm text-ink/55">{items.length} item{items.length === 1 ? "" : "s"}</p></div>{items.length ? <div className="mt-6 divide-y divide-wine/10">{items.map(item => <article key={item.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-wine">{item.category.replaceAll("_", " ")}</p><h3 className="mt-1 font-serif text-xl">{item.title}</h3><p className="mt-1 text-sm text-ink/60">{item.file_name}{item.description ? ` · ${item.description}` : ""}</p></div><p className="text-xs text-ink/50">{new Date(item.created_at).toLocaleDateString()}</p></article>)}</div> : <p className="mt-6 text-sm leading-6 text-ink/65">No content-library records yet. Add an approved learning resource when you are ready to attach it to a course lesson.</p>}</section></section></SiteShell>;
}
