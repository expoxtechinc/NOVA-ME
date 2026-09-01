// @ts-nocheck
// Vercel’s isolated serverless type pass resolves conflicting Express and
// Supabase ambient declarations. Runtime behaviour is covered by NIU tests.
import type { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const storageBucket = "niu-learning-materials";
const maxBytes = 10 * 1024 * 1024;
const allowedContentTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
]);
const extensionContentTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeFilename(value: string) {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the original header value and sanitise it below when it is not
    // valid URI encoding.
  }
  return decoded.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "").slice(0, 180) || "learning-note";
}

function contentTypeFor(filename: string, header: string) {
  const extension = `.${filename.split(".").pop()?.toLowerCase() ?? ""}`;
  return extensionContentTypes[extension] ?? header;
}

function sessionClient(token: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NIU identity service is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: token } },
  });
}

export const uploadLearningNote: RequestHandler = async (req, res) => {
  try {
    const token = headerValue(req.headers["x-supabase-authorization"]);
    const lessonId = headerValue(req.headers["x-lesson-id"]);
    const encodedFilename = headerValue(req.headers["x-file-name"]);
    const headerContentType = (headerValue(req.headers["content-type"]) || "").split(";")[0].toLowerCase();

    if (!token?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to NIU before uploading learning notes." });
    if (!z.string().uuid().safeParse(lessonId).success) return res.status(400).json({ error: "Choose a valid NIU lesson before uploading." });
    if (!encodedFilename) return res.status(400).json({ error: "Upload a PDF, Word document, text, or Markdown learning note." });
    const filename = safeFilename(encodedFilename);
    const contentType = contentTypeFor(filename, headerContentType);
    if (!allowedContentTypes.has(contentType)) return res.status(400).json({ error: "Upload a PDF, Word document, text, or Markdown learning note." });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "Choose a non-empty learning-note file." });
    if (req.body.length > maxBytes) return res.status(413).json({ error: "Learning notes must be 10 MB or smaller." });

    const supabase = sessionClient(token);
    const { data: identity } = await supabase.auth.getUser();
    if (!identity.user) return res.status(401).json({ error: "Your NIU session is no longer valid." });

    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
    if (profileError || !profile || !["instructor", "administrator", "super_admin"].includes(profile.role)) return res.status(403).json({ error: "Academic staff authority is required to upload learning notes." });

    const { data: lesson, error: lessonError } = await supabase.from("lessons").select("id").eq("id", lessonId).maybeSingle();
    if (lessonError || !lesson) return res.status(403).json({ error: "You are not authorised to attach notes to this lesson." });

    const storagePath = `${identity.user.id}/${crypto.randomUUID()}-${filename}`;
    const { error: storageError } = await supabase.storage.from(storageBucket).upload(storagePath, req.body, { contentType, upsert: false });
    if (storageError) throw new Error(storageError.message);

    const { data: contentItem, error: recordError } = await supabase.from("content_library_items").insert({
      title: filename.replace(/\.[^.]+$/, "") || "Protected learning note",
      category: "document",
      file_name: filename,
      content_type: contentType,
      storage_path: storagePath,
      description: "Private NIU learning note attached to a governed lesson.",
      status: "draft",
      governed_workflow: true,
      created_by: identity.user.id,
    }).select("id").single();
    if (recordError || !contentItem) throw new Error(recordError?.message ?? "NIU could not register this private learning note.");

    const { data: current, error: positionError } = await supabase.from("lesson_content_items").select("position").eq("lesson_id", lessonId).order("position", { ascending: false }).limit(1);
    if (positionError) throw new Error(positionError.message);
    const { error: attachmentError } = await supabase.from("lesson_content_items").insert({
      lesson_id: lessonId,
      content_item_id: contentItem.id,
      is_required: true,
      position: Number(current?.[0]?.position ?? -1) + 1,
    });
    if (attachmentError) throw new Error(attachmentError.message);

    return res.status(201).json({ message: "Learning note uploaded and attached to the protected lesson.", contentItemId: contentItem.id, lessonId, storagePath });
  } catch (error) {
    console.error("NIU learning-note upload failed", error);
    return res.status(500).json({ error: error instanceof Error && error.message ? error.message : "NIU could not upload this learning note. Please try again." });
  }
};
