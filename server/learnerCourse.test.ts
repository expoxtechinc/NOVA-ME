import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU learner assessment experience", () => {
  it("uses enrollment-bound RPCs and never renders answer keys", () => {
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "CourseLearning.tsx"), "utf8");
    expect(page).toContain("niu_list_assessments_for_learner");
    expect(page).toContain("niu_get_assessment_for_learner");
    expect(page).toContain("niu_start_assessment");
    expect(page).toContain("niu_submit_assessment");
    expect(page).toContain("target_enrollment_id: enrollmentId");
    expect(page).not.toContain("answer_key");
  });
});
