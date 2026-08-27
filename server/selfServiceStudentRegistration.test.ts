import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU self-service student registration", () => {
  it("allows verified account creation while keeping non-allowlisted identities at the student role", () => {
    const signIn = fs.readFileSync(path.join(root, "client", "src", "pages", "SignIn.tsx"), "utf8");
    const profileProvisioning = fs.readFileSync(path.join(root, "docs", "supabase", "20260826_niu_admin_allowlist_provisioning.sql"), "utf8");
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_self_service_student_registration.sql"), "utf8");
    expect(signIn).toContain("shouldCreateUser: true");
    expect(signIn).toContain("Every new account begins as a student");
    expect(profileProvisioning).toContain("else 'student'::public.app_role");
    expect(migration).toContain("drop trigger if exists niu_auth_require_allowlisted_email on auth.users");
  });

  it("keeps roles and account status behind guarded server-authorized operations", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_self_service_student_registration.sql"), "utf8");
    const access = fs.readFileSync(path.join(root, "client", "src", "pages", "AccessControl.tsx"), "utf8");
    expect(migration).toContain("profiles_direct_update_denied");
    expect(migration).toContain("niu_update_profile_account_status");
    expect(migration).toContain("Active Super Administrator authorization is required");
    expect(migration).toContain("revoke all on function public.niu_update_profile_account_status");
    expect(access).toContain('rpc("niu_update_profile_account_status"');
  });
});
