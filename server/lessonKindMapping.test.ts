import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LESSON_KIND_OPTIONS, LESSON_KIND_VALUES } from "../shared/lessonKinds";

const root = path.resolve(__dirname, "..");
const institutionalBuilder = fs.readFileSync(path.join(root, "client", "src", "pages", "InstitutionalBuilder.tsx"), "utf8");
const courseStudio = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseStudio.tsx"), "utf8");
const aiBuilder = fs.readFileSync(path.join(root, "server", "routers", "aiBuilder.ts"), "utf8");
const packageRepair = fs.readFileSync(path.join(root, "docs", "supabase", "20260829_niu_ai_draft_package_lesson_kind_repair.sql"), "utf8");
const institutionalLessonBlock = institutionalBuilder.match(/\{mode === "lesson"[\s\S]*?\}\{mode !== "review"/)?.[0] ?? "";
const courseStudioLessonBlock = courseStudio.match(/function LessonForm[\s\S]*?function ContentStudioPanel/)?.[0] ?? "";

describe("NIU lesson-kind contract", () => {
  it("matches every value verified by the live lessons_kind_check constraint", () => {
    expect(LESSON_KIND_VALUES).toEqual(["article", "video", "flashcards", "quiz", "test", "final_exam"]);
    expect(LESSON_KIND_OPTIONS.map((option) => option.value)).toEqual(LESSON_KIND_VALUES);
  });

  it("keeps both lesson authoring selects on the shared valid option list", () => {
    expect(institutionalBuilder).toContain("LESSON_KIND_OPTIONS.map");
    expect(institutionalBuilder).toContain('useState<LessonKind>("article")');
    expect(institutionalLessonBlock).not.toContain('value="reading"');
    expect(institutionalLessonBlock).not.toContain('value="document"');
    expect(institutionalLessonBlock).not.toContain('value="audio"');
    expect(institutionalLessonBlock).not.toContain('value="assignment"');
    expect(institutionalLessonBlock).not.toContain('value="assessment"');
    expect(courseStudio).toContain("const lessonKinds = LESSON_KIND_OPTIONS");
    expect(courseStudioLessonBlock).not.toContain('"reading"');
    expect(courseStudioLessonBlock).not.toContain('"assignment"');
    expect(courseStudioLessonBlock).not.toContain('"assessment"');
  });

  it("keeps rich text, transcript, captions, and protected content separate from kind", () => {
    expect(institutionalBuilder).toContain('rich_text: lessonKind === "article"');
    expect(institutionalBuilder).toContain("caption_text");
    expect(institutionalBuilder).toContain("transcript_text");
    expect(courseStudio).toContain('rich_text: lessonForm.kind === "article"');
    expect(courseStudio).toContain("caption_text");
    expect(courseStudio).toContain("transcript_text");
    expect(packageRepair).toContain("coalesce(lesson_item->>'kind','article')");
    expect(packageRepair).not.toContain("coalesce(lesson_item->>'kind','reading')");
  });

  it("uses the valid default for AI-generated draft lessons", () => {
    expect(aiBuilder).toContain('import { DEFAULT_LESSON_KIND } from "../../shared/lessonKinds";');
    expect(aiBuilder).toContain("kind: DEFAULT_LESSON_KIND");
    expect(aiBuilder).not.toContain('kind: "reading"');
  });
});
