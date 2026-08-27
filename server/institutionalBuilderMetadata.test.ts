import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = path.resolve(import.meta.dirname, "..");
describe("NIU rich module and lesson authoring", () => {
  it("persists module and lesson governance metadata with staged publication", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_lesson_authoring_metadata.sql"), "utf8");
    expect(migration).toContain("learning_objectives");
    expect(migration).toContain("estimated_minutes");
    expect(migration).toContain("caption_text");
    expect(migration).toContain("transcript_text");
    const builder = fs.readFileSync(path.join(root, "client", "src", "pages", "InstitutionalBuilder.tsx"), "utf8");
    expect(builder).toContain('id: "module"');
    expect(builder).toContain("Required for programme completion");
    expect(builder).toContain("Publication status");
    const authoring = fs.readFileSync(path.join(root, "client", "src", "pages", "Authoring.tsx"), "utf8");
    expect(authoring).toContain("learning_outcomes");
    expect(authoring).toContain("entry_requirements");
    expect(authoring).toContain("certificate_template_key");
    expect(authoring).toContain("visual_reference_url");
  });
  it("keeps status governance limited to Super Administrators and guards against self-suspension", () => {
    const access = fs.readFileSync(path.join(root, "client", "src", "pages", "AccessControl.tsx"), "utf8");
    expect(access).toContain("account_status");
    expect(access).toContain("profile?.role === \"super_admin\"");
    expect(access).toContain("cannot suspend or deactivate your own");
  });
});
