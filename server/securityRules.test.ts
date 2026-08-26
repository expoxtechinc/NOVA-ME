import { describe, expect, it } from "vitest";
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
});
