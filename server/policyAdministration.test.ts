import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU policy and programme administration", () => {
  it("uses accountable policy functions, recorded review, and staged publication instead of direct writes", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_policy_and_programme_administration.sql"), "utf8");
    expect(migration).toContain("reviewed_by uuid");
    expect(migration).toContain("niu_create_policy_page");
    expect(migration).toContain("niu_update_policy_page");
    expect(migration).toContain("policy_pages_direct_update_denied");
    expect(migration).toContain("policy_page_updated");
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "PolicyAdministration.tsx"), "utf8");
    expect(page).toContain('rpc("niu_create_policy_page"');
    expect(page).toContain('rpc("niu_update_policy_page"');
    expect(page).toContain("Publication stage");
  });

  it("captures complete certificate-programme metadata in the protected builder and keeps publication package-controlled", () => {
    const builder = fs.readFileSync(path.join(root, "client", "src", "pages", "InstitutionalBuilder.tsx"), "utf8");
    expect(builder).toContain("programmeObjectives");
    expect(builder).toContain("programmeOutcomes");
    expect(builder).toContain("programmeRequirements");
    expect(builder).toContain("programmeCompletionRules");
    expect(builder).toContain("programmeDifficulty");
    expect(builder).toContain("certificate_template_key");
    expect(builder).toContain("image_path: programmeVisualReference");
    expect(builder).toContain("Programme publication is released only");
  });
});
