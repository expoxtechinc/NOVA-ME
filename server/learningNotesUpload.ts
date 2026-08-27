import type { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { storagePut } from "./storage";

const maxBytes = 10 * 1024 * 1024;
const allowedContentTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
]);

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeFilename(value: string) {
  return decodeURIComponent(value).replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "").slice(0, 120) || "learning-note";
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
    const contentType = (headerValue(req.headers["content-type"]) || "").split(";")[0].toLowerCase();

    if (!token?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to NIU before uploading learning notes." });
    if (!z.string().uuid().safeParse(lessonId).success) return res.status(400).json({ error: "Choose a valid NIU lesson before uploading." });
    if (!encodedFilename || !allowedContentTypes.has(contentType)) return res.status(400).json({ error: "Upload a PDF, Word document, text, or Markdown learning note." });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "Choose a non-empty learning-note file." });
    if (req.body.length > maxBytes) return res.status(413).json({ error: "Learning notes must be 10 MB or smaller." });

    const supabase = sessionClient(token);
    const { data: identity } = await supabase.auth.getUser();
    if (!identity.user) return res.status(401).json({ error: "Your NIU session is no longer valid." });

    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
    if (profileError || !profile || !["instructor", "administrator", "super_admin"].includes(profile.role)) return res.status(403).json({ error: "Academic staff authority is required to upload learning notes." });

    const { data: lesson, error: lessonError } = await supabase.from("lessons").select("id").eq("id", lessonId).maybeSingle();
    if (lessonError || !lesson) return res.status(403).json({ error: "You are not authorised to attach notes to this lesson." });

    const filename = safeFilename(encodedFilename);
    const { key } = await storagePut(`niu-learning-notes/${lessonId}/${filename}`, req.body, contentType);
    const { error: updateError } = await supabase.from("lessons").update({ media_path: key }).eq("id", lessonId);
    if (updateError) return res.status(403).json({ error: "The note was stored but could not be attached to this lesson." });

    return res.status(201).json({ message: "Learning note uploaded and attached to the protected lesson.", mediaPath: key });
  } catch (error) {
    console.error("NIU learning-note upload failed", error);
    return res.status(500).json({ error: "NIU could not upload this learning note. Please try again." });
  }
};
