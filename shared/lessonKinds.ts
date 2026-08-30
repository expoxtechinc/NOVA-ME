export const LESSON_KIND_OPTIONS = [
  { value: "article", label: "Reading / article" },
  { value: "video", label: "Video" },
  { value: "flashcards", label: "Flashcards" },
  { value: "quiz", label: "Quiz / knowledge check" },
  { value: "test", label: "Module test" },
  { value: "final_exam", label: "Final examination" },
] as const;

export type LessonKind = (typeof LESSON_KIND_OPTIONS)[number]["value"];
export const DEFAULT_LESSON_KIND: LessonKind = "article";

export const LESSON_KIND_VALUES = LESSON_KIND_OPTIONS.map((option) => option.value) as LessonKind[];
