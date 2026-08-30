import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const scopeMigration = fs.readFileSync(path.join(root, "docs", "supabase", "20260830_niu_programme_package_scope.sql"), "utf8");
const aiRpc = fs.readFileSync(path.join(root, "docs", "supabase", "20260828_niu_ai_draft_package_rpc.sql"), "utf8");
const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");

describe("programme package scope governance", () => {
  it("defines explicit module and lesson scope without deleting academic records", () => {
    expect(scopeMigration).toContain("create table if not exists public.program_modules");
    expect(scopeMigration).toContain("create table if not exists public.program_lessons");
    expect(scopeMigration).toContain("references public.course_modules(id) on delete restrict");
    expect(scopeMigration).toContain("references public.lessons(id) on delete restrict");
    expect(scopeMigration).toContain("the course/module/lesson rows themselves remain intact");
    expect(scopeMigration).not.toMatch(/delete\s+from\s+public\.(courses|course_modules|lessons)/i);
  });

  it("calculates readiness and publication from explicit package links", () => {
    expect(scopeMigration).toContain("from public.program_modules pm");
    expect(scopeMigration).toContain("from public.program_lessons pl");
    expect(scopeMigration).toContain("l.id = pl.lesson_id and l.module_id = pl.module_id");
    expect(scopeMigration).toContain("where pm.program_id = target_program_id and pm.is_required");
    expect(scopeMigration).toContain("where pl.program_id = target_program_id and pl.is_required");
    expect(scopeMigration).toContain("update public.course_modules set status = 'published' where id in (select module_id from public.program_modules");
    expect(scopeMigration).toContain("update public.lessons set status = 'published' where id in (select lesson_id from public.program_lessons");
    expect(scopeMigration).toContain("assessment_required");
    expect(scopeMigration).toContain("certificate_template_valid");
    expect(scopeMigration).not.toContain("where pc.program_id = target_program_id;\n\n  select count(*), count(*) filter (where m.status");
  });

  it("persists scope links for future Course Studio and AI package records", () => {
    expect(studio).toContain('from("program_modules").insert');
    expect(studio).toContain('from("program_lessons").insert');
    expect(aiRpc).toContain("insert into public.program_modules");
    expect(aiRpc).toContain("insert into public.program_lessons");
    expect(aiRpc).toContain("coalesce(lesson_item->>'kind','article')");
    expect(aiRpc).not.toContain("coalesce(lesson_item->>'kind','reading')");
  });
});
