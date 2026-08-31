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
    expect(page).toContain('from("lesson_content_items")');
    expect(page).toContain("Recommended next action");
    expect(page).toContain("Each course can have as many level-aware modules");
    expect(page).toContain("/module-blueprint?programmeId=");
    expect(page).toContain("Recommended next action");
  });
  it("registers the programme-package workspace as the unified Course Studio route", () => {
    const app = fs.readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8");
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(app).toContain('path="/programme-package" component={CourseStudio}');
    expect(studio).toContain('rpc("niu_programme_bundle_readiness"');
    expect(studio).toContain("Counts only records linked to the selected programme package.");
    expect(studio).not.toContain('label: "Protected learning material review", ok: false');
  });
});
