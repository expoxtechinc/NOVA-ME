import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isPublicCredentialDisclosure, mayManageCredential, mayManageInstitution, mayReceiveProtectedMedia } from "./academicRules";

describe("NIU security rules", () => {
  it("limits institutional authoring to staff roles", () => {
    expect(mayManageInstitution("student")).toBe(false);
    expect(mayManageInstitution("instructor")).toBe(true);
    expect(mayManageInstitution("administrator")).toBe(true);
  });
  it("allows credential operations only for registrar-assigned or administrative roles", () => {
    expect(mayManageCredential("instructor", false)).toBe(false);
    expect(mayManageCredential("student", true)).toBe(true);
    expect(mayManageCredential("super_admin", false)).toBe(true);
  });
  it("requires both active enrollment and a stored path for signed-media delivery", () => {
    expect(mayReceiveProtectedMedia(false, "learning/example.pdf")).toBe(false);
    expect(mayReceiveProtectedMedia(true, null)).toBe(false);
    expect(mayReceiveProtectedMedia(true, "learning/example.pdf")).toBe(true);
  });
  it("rejects private learner fields from public verification disclosures", () => {
    expect(isPublicCredentialDisclosure(["credentialNumber", "status", "credentialTitle"])).toBe(true);
    expect(isPublicCredentialDisclosure(["credentialNumber", "email"])).toBe(false);
  });
  it("removes the mutually recursive lesson-content read policies", () => {
    const migration = fs.readFileSync(path.join(import.meta.dirname, "..", "docs", "supabase", "20260912_niu_fix_lesson_content_rls_recursion.sql"), "utf8");
    expect(migration).toContain("drop policy if exists lesson_content_enrolled_read");
    expect(migration).toContain("drop policy if exists content_library_enrolled_read");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("niu_can_access_published_lesson_content");
    expect(migration).toContain("program_enrollments");
    expect(migration).toContain("public.enrollments");
    expect(migration).not.toContain("from public.lesson_content_items lci\n          join public.content_library_items cli\n          where lci.content_item_id = content_library_items.id");
    expect(migration).toContain("RLS remains enabled");
  });
});
