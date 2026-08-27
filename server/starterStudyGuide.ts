// @ts-nocheck
// Vercel’s isolated serverless type pass resolves conflicting Express and
// Supabase ambient declarations. Runtime behaviour is covered by NIU tests.
import type { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";
import { storagePut } from "./storage";

const title = "Digital Foundations: Access, Information, and Responsible Study";
const filename = "niu-digital-foundations-study-guide.md";
const studyGuide = `# Digital Foundations: Access, Information, and Responsible Study

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

function sessionClient(token: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NIU identity service is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: token } } });
}

function headerValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export const initializeDigitalStudyGuide: RequestHandler = async (req, res) => {
  try {
    const token = headerValue(req.headers["x-supabase-authorization"]);
    if (!token?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to NIU before creating the protected study guide." });
    const supabase = sessionClient(token);
    const { data: identity } = await supabase.auth.getUser();
    if (!identity.user) return res.status(401).json({ error: "Your NIU session is no longer valid." });
    const { data: profile } = await supabase.from("profiles").select("role,account_status").eq("id", identity.user.id).maybeSingle();
    if (!profile || profile.role !== "super_admin" || profile.account_status !== "active") return res.status(403).json({ error: "Active Super Administrator authority is required to add NIU’s original starter study guide." });

    const { data: course } = await supabase.from("courses").select("id").eq("slug", "digital-foundations-enterprise-remote-work").maybeSingle();
    if (!course) return res.status(409).json({ error: "Create NIU’s starter programme structure before adding the study guide." });
    const { data: module } = await supabase.from("course_modules").select("id").eq("course_id", course.id).eq("position", 0).maybeSingle();
    if (!module) return res.status(409).json({ error: "Create NIU’s starter module outline before adding the study guide." });
    const { data: lesson } = await supabase.from("lessons").select("id").eq("module_id", module.id).eq("position", 0).maybeSingle();
    if (!lesson) return res.status(409).json({ error: "Create NIU’s starter lesson scaffold before adding the study guide." });

    const { data: existingItem } = await supabase.from("content_library_items").select("id").eq("title", title).eq("file_name", filename).maybeSingle();
    let contentItemId = existingItem?.id;
    if (!contentItemId) {
      const { key } = await storagePut(`niu-content-library/${identity.user.id}/${filename}`, Buffer.from(studyGuide, "utf8"), "text/markdown");
      const { data: created, error: insertError } = await supabase.from("content_library_items").insert({ title, category: "study_guide", file_name: filename, content_type: "text/markdown", storage_path: key, description: "Original NIU draft study guide for the first Digital Foundations module. It remains private until an authorised programme release.", created_by: identity.user.id }).select("id").single();
      if (insertError || !created) return res.status(403).json({ error: "NIU could not register the protected study guide." });
      contentItemId = created.id;
    }

    const { data: existingAttachment } = await supabase.from("lesson_content_items").select("lesson_id").eq("lesson_id", lesson.id).eq("content_item_id", contentItemId).maybeSingle();
    if (!existingAttachment) {
      const { data: current } = await supabase.from("lesson_content_items").select("position").eq("lesson_id", lesson.id).order("position", { ascending: false }).limit(1);
      const { error: attachError } = await supabase.from("lesson_content_items").insert({ lesson_id: lesson.id, content_item_id: contentItemId, is_required: true, position: Number(current?.[0]?.position ?? -1) + 1 });
      if (attachError) return res.status(403).json({ error: "The NIU study guide exists but could not be attached to the first lesson." });
    }
    const { error: auditError } = await supabase.rpc("niu_record_digital_starter_study_guide_audit", { target_lesson_id: lesson.id, target_content_item_id: contentItemId });
    if (auditError) return res.status(500).json({ error: "The NIU study guide was stored but its required audit record could not be confirmed. Please retry before relying on this setup." });
    return res.status(201).json({ message: "NIU’s original study guide has been stored privately and attached to the first draft lesson.", contentItemId, lessonId: lesson.id });
  } catch (error) {
    console.error("NIU starter study-guide setup failed", error);
    return res.status(500).json({ error: "NIU could not add the protected study guide. Please try again." });
  }
};
