import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU protected starter programme setup", () => {
  it("creates only controlled draft structural records through an active Super Administrator function", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_digital_starter_setup.sql"), "utf8");
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "StarterProgrammeSetup.tsx"), "utf8");
    expect(migration).toContain("niu_initialize_digital_starter_programme");
    expect(migration).toContain("role = 'super_admin' and account_status = 'active'");
    expect(migration).toContain("'draft'");
    expect(migration).toContain("digital_starter_programme_initialized");
    expect(migration).toContain("declare v_program_id uuid");
    expect(migration).toContain("on conflict on constraint program_courses_pkey do nothing");
    expect(migration).toContain("revoke all on function public.niu_initialize_digital_starter_programme() from public, anon");
    expect(page).toContain('rpc("niu_initialize_digital_starter_programme")');
    expect(page).toContain("It will not create modules, lessons, notes, tests, learners, payments, or public listings");
  });
});
