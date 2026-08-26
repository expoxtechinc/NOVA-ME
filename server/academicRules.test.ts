import { describe, expect, it } from "vitest";
import { canTransitionCandidateStatus, isValidAssessmentControl, isValidFinalScore } from "./academicRules";

describe("NIU academic workflow rules", () => {
  it("allows only forward credential candidate review transitions", () => {
    expect(canTransitionCandidateStatus("eligible", "under_review")).toBe(true);
    expect(canTransitionCandidateStatus("under_review", "approved")).toBe(true);
    expect(canTransitionCandidateStatus("approved", "issued")).toBe(true);
    expect(canTransitionCandidateStatus("issued", "approved")).toBe(false);
    expect(canTransitionCandidateStatus("ineligible", "issued")).toBe(false);
  });

  it("rejects invalid assessment controls", () => {
    expect(isValidAssessmentControl(70, 2, 45, 30)).toBe(true);
    expect(isValidAssessmentControl(101, 2, 45, 30)).toBe(false);
    expect(isValidAssessmentControl(70, 0, 45, 30)).toBe(false);
    expect(isValidAssessmentControl(70, 2, 0, 30)).toBe(false);
    expect(isValidAssessmentControl(70, 2, 45, 101)).toBe(false);
  });

  it("accepts only bounded credential scores", () => {
    expect(isValidFinalScore(0)).toBe(true);
    expect(isValidFinalScore(100)).toBe(true);
    expect(isValidFinalScore(-1)).toBe(false);
    expect(isValidFinalScore(100.1)).toBe(false);
  });
});
