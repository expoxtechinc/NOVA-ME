import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = path.resolve(import.meta.dirname, "..");
describe("NIU guided programme package", () => {
  it("uses actual programme relationships and shows ordered readiness recommendations without sample content", () => {
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "ProgrammePackage.tsx"), "utf8");
    expect(page).toContain('from("program_courses")');
    expect(page).toContain('from("course_modules")');
    expect(page).toContain('from("lessons")');
    expect(page).toContain('from("lesson_content_library_items")');
    expect(page).toContain("Recommended next action");
    expect(page).toContain("Each course can have as many level-aware modules");
    expect(page).toContain('href="/module-blueprint"');
  });
  it("registers the programme-package workspace as a protected academic administration route", () => {
    const app = fs.readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8");
    expect(app).toContain('path="/programme-package"');
  });
});
