import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = path.resolve(import.meta.dirname, "..");
describe("NIU existing-user governance", () => {
  it("protects role reassignment and scoped course assignments", () => {
    const sql = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_existing_user_governance.sql"), "utf8");
    expect(sql).toContain("staff_course_assignments");
    expect(sql).toContain("niu_reassign_profile_role");
    expect(sql).toContain("You cannot change your own role");
    expect(sql).toContain("profile_role_reassigned");
    expect(sql).toContain("revoke all");
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "PeopleGovernance.tsx"), "utf8");
    expect(page).toContain('rpc("niu_reassign_profile_role"');
    expect(page).toContain('from("staff_course_assignments")');
  });
});
