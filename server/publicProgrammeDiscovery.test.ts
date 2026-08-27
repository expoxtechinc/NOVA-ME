import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU public programme discovery", () => {
  it("uses direct published-only Supabase reads instead of the unavailable Vercel catalogue procedure", () => {
    const catalogue = fs.readFileSync(path.join(root, "client", "src", "pages", "Programs.tsx"), "utf8");
    const detail = fs.readFileSync(path.join(root, "client", "src", "pages", "ProgramDetails.tsx"), "utf8");
    expect(catalogue).toContain('from("certificate_programs")');
    expect(catalogue).toContain('.eq("status", "published")');
    expect(catalogue).not.toContain("trpc.catalog.listPrograms");
    expect(detail).toContain('from("certificate_programs")');
    expect(detail).toContain('.eq("status", "published")');
    expect(detail).not.toContain("trpc.catalog.getPublishedProgram");
    const courseList = fs.readFileSync(path.join(root, "client", "src", "pages", "Courses.tsx"), "utf8");
    const courseDetail = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseDetails.tsx"), "utf8");
    expect(courseList).toContain('from("courses")');
    expect(courseList).toContain('.eq("status", "published")');
    expect(courseList).not.toContain("trpc.course.list");
    expect(courseDetail).toContain('from("courses")');
    expect(courseDetail).toContain('.eq("status", "published")');
    expect(courseDetail).not.toContain("trpc.course.getPublic");
  });

  it("uses a dedicated trigger for the composite lesson-content attachment key", () => {
    const repair = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_content_library_audit_trigger_repair.sql"), "utf8");
    expect(repair).toContain("niu_capture_content_library_audit_event");
    expect(repair).toContain("old.content_item_id::text");
    expect(repair).toContain("new.content_item_id::text");
    expect(repair).not.toContain("execute function public.niu_capture_audit_event()");
  });

  it("keeps first-certificate publication behind four original protected materials and the existing readiness gate", () => {
    const releasePage = fs.readFileSync(path.join(root, "client", "src", "pages", "FirstCertificateRelease.tsx"), "utf8");
    const approval = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_digital_starter_bundle_approval.sql"), "utf8");
    expect(releasePage).toContain("const guides = [");
    expect(releasePage).toContain('supabase.rpc("niu_approve_digital_starter_bundle")');
    expect(releasePage).toContain('supabase.rpc("niu_publish_programme_bundle"');
    expect(approval).toContain("v_module_count <> 4 or v_lesson_count <> 4 or v_material_count <> 4");
    expect(approval).toContain("p.award_type = 'certificate'");
    expect(approval).toContain("revoke all on function public.niu_approve_digital_starter_bundle() from public, anon");
  });
});
