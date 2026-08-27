import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU protected starter study guide", () => {
  it("uses an active Super Administrator session to store an original guide privately and attach it to the first draft lesson", () => {
    const handler = fs.readFileSync(path.join(root, "server", "starterStudyGuide.ts"), "utf8");
    const contentPage = fs.readFileSync(path.join(root, "client", "src", "pages", "ContentLibrary.tsx"), "utf8");
    const noteHandler = fs.readFileSync(path.join(root, "server", "learningNotesUpload.ts"), "utf8");
    const auditMigration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_digital_starter_study_guide_audit.sql"), "utf8");
    expect(handler).toContain("profile.role !== \"super_admin\" || profile.account_status !== \"active\"");
    expect(handler).toContain("storagePut(`niu-content-library/${identity.user.id}/${filename}`");
    expect(handler).toContain('category: "study_guide"');
    expect(handler).toContain('from("lesson_content_items").insert');
    expect(handler).toContain("if (!existingAttachment)");
    expect(handler).toContain('rpc("niu_record_digital_starter_study_guide_audit"');
    expect(handler).toContain("if (auditError)");
    expect(auditMigration).toContain("digital_starter_study_guide_initialized");
    expect(auditMigration).toContain("public.niu_is_active_super_admin()");
    expect(auditMigration).toContain("revoke all on function public.niu_record_digital_starter_study_guide_audit");
    expect(handler).toContain("Draft teaching material—academic review required before publishing.");
    expect(contentPage).toContain('fetch("/api/content-library/initialize-digital-study-guide"');
    expect(contentPage).toContain("Add NIU draft study guide");
    expect(noteHandler).toContain("update({ media_path: key })");
    expect(noteHandler).not.toContain('update({ kind: "document", media_path: key })');
  });
});
