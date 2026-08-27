import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU protected starter lesson scaffold", () => {
  it("creates only required draft lesson placeholders through an active Super Administrator action", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_digital_starter_lessons.sql"), "utf8");
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "ModuleBlueprint.tsx"), "utf8");
    expect(migration).toContain("niu_initialize_digital_starter_lessons");
    expect(migration).toContain("role = 'super_admin' and account_status = 'active'");
    expect(migration).toContain("digital_starter_lesson_scaffold_initialized");
    expect(migration).toContain("'article'");
    expect(migration).not.toContain("'reading'");
    expect(migration).not.toContain("'assignment'");
    expect(migration).toContain("revoke all on function public.niu_initialize_digital_starter_lessons() from public, anon");
    expect(page).toContain('rpc("niu_initialize_digital_starter_lessons")');
    expect(page).toContain("It creates no materials, assessments, learners, or public content.");
  });
});
