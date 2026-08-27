import { AlertCircle, CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import SiteShell from "@/components/SiteShell";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const bucket = "niu-learning-materials";
const courseSlug = "digital-foundations-enterprise-remote-work";
const guides = [
  { modulePosition: 0, fileName: "niu-digital-foundations-study-guide.md", title: "Digital Foundations: Access, Information, and Responsible Study", description: "Original NIU guide for secure, inclusive study and credible information.", body: `# Digital Foundations: Access, Information, and Responsible Study

> Original NIU teaching material—academic review required before publishing.

This certificate-only learning guide supports safe, inclusive digital study. It makes no claim about accreditation, professional licence, employment, or external recognition.

## Start with access and safety

Use a current browser, a private password or passphrase, and a reliable place to keep course files. On a shared device, sign out when you finish. Do not share passwords, sign-in links, or verification codes.

## Check information before use

Ask who made the information, why it was published, when it was updated, and whether an important claim can be confirmed by another credible source. Record source details when a task asks for evidence.

## Study access and wellbeing

Use captions, transcripts, notes, or downloaded material where they help. Break work into focused sessions. Ask NIU for support early if access, disability, connectivity, language, or another barrier affects participation.

## Learning activity

Create a private study plan with one account-safety habit, one information-checking method, and one support that would make learning more accessible.

## Source and use note

This is original NIU draft teaching material. Academic review is required before authorised publication.
` },
  { modulePosition: 1, fileName: "niu-collaborative-remote-work-study-guide.md", title: "Collaborative Remote Work: Respectful Practice Guide", description: "Original NIU guide for clear, inclusive, and private remote collaboration.", body: `# Collaborative Remote Work: Respectful Practice Guide

> Original NIU teaching material—academic review required before publishing.

This certificate-only guide covers practical collaboration habits. It does not guarantee employment, professional recognition, or any external credential.

## Agree the work

Before starting, agree the purpose, roles, deadline, and approved place for files. Use clear file names and record changes so people can understand what changed and when.

## Communicate with care

State context and the action needed. Use respectful language, avoid assumptions about time zones and connectivity, and make space for questions. Headings, concise text, captions, and downloadable documents can reduce barriers.

## Protect people and information

Share only the material needed for learning. Do not repost another person’s private information, work, image, or contact details without permission. Check sharing settings before sending a link.

## Learning activity

Create a one-page plan for a small shared task. Include roles, a communication method, a deadline, a file location, and one privacy practice.

## Source and use note

This is original NIU draft teaching material. Academic review is required before authorised publication.
` },
  { modulePosition: 2, fileName: "niu-digital-entrepreneurship-study-guide.md", title: "Digital Entrepreneurship: Opportunity Discovery Guide", description: "Original NIU guide for ethical, evidence-informed opportunity exploration.", body: `# Digital Entrepreneurship: Opportunity Discovery Guide

> Original NIU teaching material—academic review required before publishing.

This certificate-only guide helps learners explore a practical opportunity without assuming funding, technology, or a specific market. It is educational material, not financial, legal, or business advice.

## Observe a real need

Describe a problem in plain language. Identify who experiences it, when it happens, and why it matters. Do not treat assumptions as evidence. Start with careful observation, a credible source, or an appropriate conversation.

## Test an idea responsibly

Ask what options already exist, what may make access difficult, and what information is missing. Seek more than one perspective when possible. Do not collect unnecessary personal information or promise an outcome that cannot be supported.

## Describe possible value

Use this structure: “For [group], who need [need], a possible approach is [idea], because [reason or evidence].” Then identify one low-risk next step.

## Learning activity

Prepare a draft opportunity worksheet with a problem, audience, evidence source, inclusion consideration, and realistic next step.

## Source and use note

This is original NIU draft teaching material. Academic review is required before authorised publication.
` },
  { modulePosition: 3, fileName: "niu-responsible-remote-project-planning-study-guide.md", title: "Responsible Remote Project Planning Guide", description: "Original NIU guide for accessible, ethical, and privacy-aware remote project planning.", body: `# Responsible Remote Project Planning Guide

> Original NIU teaching material—academic review required before publishing.

This certificate-only guide supports a small remote-work or digital-project plan. It is educational material, not a promise of project success or employment.

## Define a focused outcome

State what the project will produce, who it may help, and how you will recognise that the first step is complete. Keep the scope small enough to review. Say what is outside the current work.

## Plan responsible practice

Consider whose information may be involved, whether permission is needed, and how files will be stored securely. Plan for accessible participation with clear language, usable formats, and alternatives for limited connectivity.

## Create a workable sequence

List the first three actions, a realistic timeframe, people or resources needed, and one check-in. Use evidence and feedback to revise the plan rather than treating the first version as final.

## Learning activity

Prepare a one-page plan with an outcome, audience, three actions, a privacy safeguard, an accessibility consideration, and a reflection question.

## Source and use note

This is original NIU draft teaching material. Academic review is required before authorised publication.
` },
] as const;

function filePath(userId: string, fileName: string) { return `${userId}/${crypto.randomUUID()}-${fileName}`; }

export default function FirstCertificateRelease() {
  const [role, setRole] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [releasing, setReleasing] = useState(false); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; async function load() { if (!supabaseConfigured) { if (active) setLoading(false); return; } const { data: sessionData } = await supabase.auth.getSession(); if (!active || !sessionData.session) { if (active) setLoading(false); return; } const { data: profile } = await supabase.from("profiles").select("role").eq("id", sessionData.session.user.id).maybeSingle(); if (active) { setRole(profile?.role ?? null); setLoading(false); } } void load(); return () => { active = false; }; }, []);
  async function release() {
    if (!window.confirm("Create four original NIU study guides, attach one to every required first-course lesson, approve the complete certificate-only bundle, and publish it for public discovery? This does not create learners or guarantee outcomes.")) return;
    setReleasing(true); setMessage(null); setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession(); const user = sessionData.session?.user; if (!user) throw new Error("Sign in to NIU before preparing the certificate bundle.");
      const { data: course, error: courseError } = await supabase.from("courses").select("id,status").eq("slug", courseSlug).maybeSingle(); if (courseError || !course) throw new Error("The authorised first NIU course is not available.");
      const { data: programmeLink, error: linkError } = await supabase.from("program_courses").select("program_id,certificate_programs(status)").eq("course_id", course.id).maybeSingle(); if (linkError || !programmeLink) throw new Error("The authorised first NIU certificate programme is not available.");
      const relatedProgramme = Array.isArray(programmeLink.certificate_programs) ? programmeLink.certificate_programs[0] : programmeLink.certificate_programs;
      const programmeStatus = (relatedProgramme as { status?: string } | null)?.status;
      if (programmeStatus === "published") { setMessage("NIU’s first certificate programme is already published."); return; }
      for (const guide of guides) {
        const { data: module, error: moduleError } = await supabase.from("course_modules").select("id").eq("course_id", course.id).eq("position", guide.modulePosition).maybeSingle(); if (moduleError || !module) throw new Error("The required first-course module structure is incomplete.");
        const { data: lesson, error: lessonError } = await supabase.from("lessons").select("id").eq("module_id", module.id).eq("position", 0).maybeSingle(); if (lessonError || !lesson) throw new Error("The required first-course lesson structure is incomplete.");
        const { data: existing, error: existingError } = await supabase.from("content_library_items").select("id").eq("file_name", guide.fileName).eq("category", "study_guide").maybeSingle(); if (existingError) throw new Error(existingError.message);
        let itemId = existing?.id;
        if (!itemId) { const path = filePath(user.id, guide.fileName); const { error: uploadError } = await supabase.storage.from(bucket).upload(path, new File([guide.body], guide.fileName, { type: "text/markdown" }), { contentType: "text/markdown", upsert: false }); if (uploadError) throw new Error(uploadError.message); const { data: created, error: insertError } = await supabase.from("content_library_items").insert({ title: guide.title, category: "study_guide", file_name: guide.fileName, content_type: "text/markdown", storage_path: path, description: guide.description, created_by: user.id }).select("id").single(); if (insertError || !created) { await supabase.storage.from(bucket).remove([path]); throw new Error(insertError?.message ?? "NIU could not register an original study guide."); } itemId = created.id; }
        const { data: attached, error: attachedError } = await supabase.from("lesson_content_items").select("lesson_id").eq("lesson_id", lesson.id).eq("content_item_id", itemId).maybeSingle(); if (attachedError) throw new Error(attachedError.message); if (!attached) { const { data: last, error: positionError } = await supabase.from("lesson_content_items").select("position").eq("lesson_id", lesson.id).order("position", { ascending: false }).limit(1); if (positionError) throw new Error(positionError.message); const { error: attachmentError } = await supabase.from("lesson_content_items").insert({ lesson_id: lesson.id, content_item_id: itemId, is_required: true, position: Number(last?.[0]?.position ?? -1) + 1 }); if (attachmentError) throw new Error(attachmentError.message); }
      }
      const { data: readiness, error: approvalError } = await supabase.rpc("niu_approve_digital_starter_bundle"); if (approvalError || !readiness?.ready) throw new Error(approvalError?.message ?? "NIU could not approve the complete certificate bundle.");
      const { error: publishError } = await supabase.rpc("niu_publish_programme_bundle", { target_program_id: programmeLink.program_id }); if (publishError) throw new Error(publishError.message);
      setMessage("NIU’s first certificate programme is published with four original protected study guides and public discovery enabled.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "NIU could not prepare and publish the first certificate bundle."); }
    finally { setReleasing(false); }
  }
  if (loading) return <SiteShell><div className="grid min-h-[55vh] place-items-center"><LoaderCircle className="h-8 w-8 animate-spin text-wine" /></div></SiteShell>;
  if (role !== "super_admin") return <SiteShell><section className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-5 text-center"><ShieldAlert className="h-10 w-10 text-wine" /><h1 className="mt-5 font-serif text-4xl">Super Administrator authority required.</h1><p className="mt-3 leading-7 text-ink/65">NIU reserves first-bundle approval and publication for its active Super Administrator.</p><Link href={role ? "/portal" : "/signin"} className="button-primary mt-7">{role ? "Return to My NIU" : "Sign in to NIU"}</Link></section></SiteShell>;
  return <SiteShell><section className="border-b border-wine/10 bg-canvas"><div className="mx-auto max-w-4xl px-5 py-14 sm:px-8"><p className="eyebrow">Controlled certificate release</p><h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Publish NIU’s first certificate programme.</h1><p className="mt-4 max-w-3xl leading-7 text-ink/70">This single protected action creates four original Markdown study guides, attaches one to each required lesson, validates the complete bundle, and calls NIU’s existing certificate-only publication gate.</p></div></section><section className="mx-auto max-w-4xl px-5 py-12 sm:px-8">{(message || error) && <p className={`flex gap-2 border-l-4 p-4 text-sm ${error ? "border-wine bg-wine/5" : "border-emerald-700 bg-emerald-50 text-emerald-900"}`}><AlertCircle className="h-5 w-5 shrink-0" />{error ?? message}</p>}<div className="mt-7 border border-wine/10 bg-white p-7"><CheckCircle2 className="h-7 w-7 text-wine" /><h2 className="mt-4 font-serif text-3xl">What NIU will do</h2><ul className="mt-5 grid gap-3 text-sm leading-6 text-ink/70"><li>Store four original NIU study guides in private object storage.</li><li>Attach one required guide to each of the four authorised draft lessons.</li><li>Approve only the defined certificate bundle after it meets the material and structure gate.</li><li>Publish the certificate programme and course for public discovery while retaining enrolled-only access to materials.</li></ul><button type="button" onClick={release} disabled={releasing} className="button-primary mt-7 disabled:opacity-60">{releasing ? "Preparing certificate bundle…" : "Prepare and publish NIU’s first certificate course"}</button><Link href="/content-library" className="ml-4 inline-flex text-sm font-bold text-wine">Return to Content Library</Link></div></section></SiteShell>;
}
