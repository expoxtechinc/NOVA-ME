import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("protected learning-note uploads", () => {
  it("registers a raw-body upload route with a bounded payload", () => {
    const app = fs.readFileSync(path.join(root, "server", "app.ts"), "utf8");
    expect(app).toContain('/api/learning-notes/upload');
    expect(app).toContain('express.raw({ type: "*/*", limit: "10mb" })');
  });

  it("requires a valid NIU session and staff role before attaching an uploaded note", () => {
    const upload = fs.readFileSync(path.join(root, "server", "learningNotesUpload.ts"), "utf8");
    expect(upload).toContain('token?.startsWith("Bearer ")');
    expect(upload).toContain('"super_admin"');
    expect(upload).toContain("allowedContentTypes");
    expect(upload).toContain("maxBytes");
    expect(upload).toContain("storagePut");
    expect(upload).toContain("update({ media_path: key })");
    expect(upload).not.toContain('update({ kind: "document", media_path: key })');
  });

  it("exposes an academic-staff upload form for supported learning-note file types", () => {
    const builder = fs.readFileSync(path.join(root, "client", "src", "pages", "InstitutionalBuilder.tsx"), "utf8");
    expect(builder).toContain('type="file"');
    expect(builder).toContain("Upload protected learning note");
    expect(builder).toContain("/api/learning-notes/upload");
  });
});
