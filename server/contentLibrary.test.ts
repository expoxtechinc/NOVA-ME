import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
describe("NIU content library", () => {
  it("uses a private Supabase bucket with a bounded direct staff upload and a metadata-only content-library record", () => {
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "ContentLibrary.tsx"), "utf8");
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_private_learning_material_storage.sql"), "utf8");
    const auditTriggers = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_content_library_audit_triggers.sql"), "utf8");
    expect(page).toContain('const storageBucket = "niu-learning-materials"');
    expect(page).toContain("selectedFile.size > maxBytes");
    expect(page).toContain("categoryMimeTypes[category].includes(selectedFile.type)");
    expect(page).toContain('storage.from(storageBucket).upload');
    expect(page).toContain('from("content_library_items").insert');
    expect(migration).toContain("public = false");
    expect(migration).toContain("niu_learning_materials_staff_insert");
    expect(migration).toContain("niu_learning_materials_enrolled_or_staff_select");
    expect(auditTriggers).toContain("niu_audit_content_library_items");
    expect(auditTriggers).toContain("niu_audit_lesson_content_items");
  });
  it("registers protected library upload and lesson attachment routes", () => {
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "ContentLibrary.tsx"), "utf8");
    const learning = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseLearning.tsx"), "utf8");
    expect(page).toContain("Attach resource");
    expect(page).toContain("external_resource");
    expect(page).toContain("async function attachItem");
    expect(learning).toContain('const storageBucket = "niu-learning-materials"');
    expect(learning).toContain("createSignedUrl(item.storage_path, 60)");
    expect(learning).not.toContain("contentUtils.media.getContentUrl.fetch");
  });

  it("uses direct signed-link navigation with visible retrieval feedback for mobile learners", () => {
    const learning = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseLearning.tsx"), "utf8");
    expect(learning).toContain('setResourceStatus("Opening protected resource…")');
    expect(learning).toContain("window.location.assign(data.signedUrl)");
    expect(learning).not.toContain("window.open(data.signedUrl");
  });
});
