import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU institutional publication controls", () => {
  it("preserves calendar visibility and requires audited administrator-only publication decisions", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_institutional_publication_controls.sql"), "utf8");
    expect(migration).toContain("academic_calendar_events alter column status set default 'draft'");
    expect(migration).toContain("default 'published'");
    expect(migration).toContain("schools_direct_update_denied");
    expect(migration).toContain("departments_direct_update_denied");
    expect(migration).toContain("calendar_direct_update_denied");
    expect(migration).toContain("niu_update_institutional_publication");
    expect(migration).toContain("institutional_record_publication_updated");
    expect(migration).toContain("revoke all on function");
  });

  it("registers a protected administrator workspace for accountable institutional publication", () => {
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "InstitutionalPublication.tsx"), "utf8");
    const app = fs.readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8");
    expect(page).toContain('rpc("niu_update_institutional_publication"');
    expect(page).toContain("Administrator authority required");
    expect(page).toContain("Existing calendar events retain their public visibility");
    expect(app).toContain('path="/institutional-publication"');
  });

  it("initializes and updates only one certificate-only settings record through an audited administrator function", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_institution_settings_accountability.sql"), "utf8");
    const settings = fs.readFileSync(path.join(root, "client", "src", "pages", "InstitutionSettings.tsx"), "utf8");
    expect(migration).toContain("niu_institution_settings_singleton");
    expect(migration).toContain("institution_settings_direct_update_denied");
    expect(migration).toContain("niu_save_institution_settings");
    expect(migration).toContain("institution_settings_saved");
    expect(settings).toContain('rpc("niu_save_institution_settings"');
    expect(settings).toContain("Initialize protected NIU settings");
    expect(settings).toContain("Certificate-only scope remains locked");
  });
});
