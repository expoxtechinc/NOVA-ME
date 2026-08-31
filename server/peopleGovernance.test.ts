import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = path.resolve(import.meta.dirname, "..");
describe("NIU existing-user governance", () => {
  it("protects role reassignment and scoped course assignments", () => {
    const assignmentSchema = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_existing_user_governance.sql"), "utf8");
    const integrityFix = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_governance_and_content_integrity.sql"), "utf8");
    expect(assignmentSchema).toContain("staff_course_assignments");
    expect(integrityFix).toContain("niu_reassign_profile_role");
    expect(integrityFix).toContain("You cannot change your own role");
    expect(integrityFix).toContain("profile_role_reassigned");
    expect(integrityFix).toContain("revoke all");
    expect(integrityFix).not.toContain("profile_role_assignments");
    expect(integrityFix).toContain("lesson_content_items");
    expect(integrityFix).not.toContain("lesson_content_library_items");
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "PeopleGovernance.tsx"), "utf8");
    expect(page).toContain('rpc("niu_reassign_profile_role"');
    expect(page).toContain('rpc("niu_update_profile_account_status"');
    expect(page).toContain('value="suspended"');
    expect(page).toContain('value="inactive"');
    expect(page).toContain("A Super Administrator cannot suspend or deactivate their own active account.");
    expect(page).toContain('from("staff_course_assignments")');
    expect(page).toContain("core profile role");
  });
});
