import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU protected starter module outline", () => {
  it("creates a four-part draft-only outline without learner-facing content and denies anonymous execution", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_digital_starter_modules.sql"), "utf8");
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "ModuleBlueprint.tsx"), "utf8");
    expect(migration).toContain("niu_initialize_digital_starter_modules");
    expect(migration).toContain("role = 'super_admin' and account_status = 'active'");
    expect(migration).toContain("digital_starter_module_outline_initialized");
    expect(migration).toContain("'foundation'");
    expect(migration).toContain("'developing'");
    expect(migration).toContain("'applied'");
    expect(migration).toContain("'capstone'");
    expect(migration).toContain("revoke all on function public.niu_initialize_digital_starter_modules() from public, anon");
    expect(page).toContain('rpc("niu_initialize_digital_starter_modules")');
    expect(page).toContain("It creates no lessons, materials, assessments, learners, or public content.");
  });
});
