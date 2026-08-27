import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU Course Studio", () => {
  it("is routed as the unified academic-authoring workspace", () => {
    const app = fs.readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8");
    const dashboard = fs.readFileSync(path.join(root, "client", "src", "pages", "AdminDashboard.tsx"), "utf8");
    expect(app).toContain('const CourseStudio = lazy(() => import("./pages/CourseStudio"));');
    expect(app).toContain('<Route path="/course-studio" component={CourseStudio} />');
    expect(dashboard).toContain('["Course Studio — create programme", "/course-studio"]');
  });

  it("keeps the Course Studio workspace staff-only and certificate-only", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(studio).toContain('const staff = role === "instructor" || role === "administrator" || role === "super_admin"');
    expect(studio).toContain('if (!staff) return <SiteShell>');
    expect(studio).toContain('award_type: "certificate"');
    expect(studio).toContain('status: "draft"');
    expect(studio).toContain('created_by: userId');
    expect(studio).toContain("Final publishing remains reviewer-authorised and certificate-only.");
  });

  it("creates real programme, course, module, and lesson relationships without page redirects", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(studio).toContain('from("certificate_programs").insert');
    expect(studio).toContain('from("courses").insert');
    expect(studio).toContain('from("course_versions").insert');
    expect(studio).toContain('from("program_courses").insert');
    expect(studio).toContain('from("course_modules").insert');
    expect(studio).toContain('from("lessons").insert');
    expect(studio).toContain('setStep("curriculum")');
    expect(studio).toContain('setStep("lesson")');
    expect(studio).not.toContain('window.location');
  });

  it("keeps protected content, assessment, preview, and publication as governed Course Studio panels", () => {
    const studio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
    expect(studio).toContain('step === "content"');
    expect(studio).toContain('step === "assessment"');
    expect(studio).toContain('step === "preview"');
    expect(studio).toContain('href: "/content-library"');
    expect(studio).toContain('href: "/assessment-builder"');
    expect(studio).toContain('href="/programme-publication"');
    expect(studio).toContain("Protected materials stay in private object storage.");
  });
});
