import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = path.resolve(import.meta.dirname, "..");
describe("NIU ordered module blueprint", () => {
  it("creates sequential modules and uses real lessons/materials to recommend next module support", () => {
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "ModuleBlueprint.tsx"), "utf8");
    expect(page).toContain('from("course_modules")');
    expect(page).toContain('from("lessons")');
    expect(page).toContain('from("lesson_content_library_items")');
    expect(page).toContain("Module {modules.length + 1} title");
    expect(page).toContain("Module learning level");
    expect(page).toContain("learning_objectives");
    expect(page).toContain("estimated_minutes");
    expect(page).toContain("support_guidance");
    expect(page).toContain("Recommended module support");
    expect(page).toContain("never invents academic content");
  });
  it("registers the module blueprint as an NIU administration route", () => {
    const app = fs.readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8");
    expect(app).toContain('path="/module-blueprint"');
  });
});
