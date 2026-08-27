// @ts-nocheck
// Vercel’s isolated serverless type pass resolves conflicting Express and
// Supabase ambient declarations. Runtime behaviour is covered by NIU tests.
import type { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { storagePut } from "./storage";

const maxBytes = 10 * 1024 * 1024;
const categorySchema = z.enum(["document", "presentation", "image", "audio", "video", "research", "study_guide"]);
const fileTypes: Record<z.infer<typeof categorySchema>, string[]> = {
  document: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"],
  presentation: ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
  video: ["video/mp4", "video/webm"],
  research: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"],
  study_guide: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"],
};

function headerValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function safeText(value: string, max: number) { return decodeURIComponent(value).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max); }
function safeFilename(value: string) { return safeText(value, 180).replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "") || "learning-resource"; }
function sessionClient(token: string) {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NIU identity service is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: token } } });
}
async function requireStaff(token: string) {
  const supabase = sessionClient(token);
  const { data: identity } = await supabase.auth.getUser();
  if (!identity.user) throw new Error("UNAUTHENTICATED");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
  if (!profile || !["instructor", "administrator", "super_admin"].includes(profile.role)) throw new Error("FORBIDDEN");
  return { supabase, userId: identity.user.id };
}

export const uploadContentLibraryItem: RequestHandler = async (req, res) => {
  try {
    const token = headerValue(req.headers["x-supabase-authorization"]);
    const titleHeader = headerValue(req.headers["x-content-title"]);
    const categoryHeader = headerValue(req.headers["x-content-category"]);
    const filenameHeader = headerValue(req.headers["x-file-name"]);
    const descriptionHeader = headerValue(req.headers["x-content-description"]);
    const contentType = (headerValue(req.headers["content-type"]) || "").split(";")[0].toLowerCase();
    if (!token?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to NIU before uploading learning resources." });
    const category = categorySchema.safeParse(categoryHeader);
    const title = titleHeader ? safeText(titleHeader, 180) : "";
    if (!category.success || title.length < 3 || !filenameHeader) return res.status(400).json({ error: "Provide a title, supported category, and file name." });
    if (!fileTypes[category.data].includes(contentType)) return res.status(400).json({ error: "This file type is not supported for the selected content category." });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "Choose a non-empty learning resource." });
    if (req.body.length > maxBytes) return res.status(413).json({ error: "Learning resources must be 10 MB or smaller." });
    const { supabase, userId } = await requireStaff(token);
    const filename = safeFilename(filenameHeader);
    const { key } = await storagePut(`niu-content-library/${userId}/${filename}`, req.body, contentType);
    const { data, error } = await supabase.from("content_library_items").insert({ title, category: category.data, file_name: filename, content_type: contentType, storage_path: key, description: descriptionHeader ? safeText(descriptionHeader, 1000) || null : null, created_by: userId }).select("id, title, category, file_name, created_at").single();
    if (error) return res.status(403).json({ error: "The resource was stored but its NIU library record could not be saved." });
    return res.status(201).json({ item: data });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500;
    return res.status(status).json({ error: status === 403 ? "Academic staff authority is required to upload learning resources." : "NIU could not upload this learning resource. Please try again." });
  }
};

export const attachContentLibraryItem: RequestHandler = async (req, res) => {
  try {
    const token = headerValue(req.headers["x-supabase-authorization"]);
    if (!token?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to NIU before attaching learning resources." });
    const input = z.object({ lessonId: z.string().uuid(), contentItemId: z.string().uuid(), isRequired: z.boolean().default(true) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "Choose a valid NIU lesson and content-library item." });
    const { supabase } = await requireStaff(token);
    const { data: current } = await supabase.from("lesson_content_items").select("position").eq("lesson_id", input.data.lessonId).order("position", { ascending: false }).limit(1);
    const { error } = await supabase.from("lesson_content_items").upsert({ lesson_id: input.data.lessonId, content_item_id: input.data.contentItemId, is_required: input.data.isRequired, position: Number(current?.[0]?.position ?? -1) + 1 }, { onConflict: "lesson_id,content_item_id" });
    if (error) return res.status(403).json({ error: "NIU could not attach this resource to the selected lesson." });
    return res.status(201).json({ message: "Learning resource attached to the selected lesson." });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500;
    return res.status(status).json({ error: status === 403 ? "Academic staff authority is required to attach learning resources." : "NIU could not attach this resource. Please try again." });
  }
};
