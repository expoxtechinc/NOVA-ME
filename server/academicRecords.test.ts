import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = path.resolve(import.meta.dirname, "..");
describe("NIU automatic certificates and transcripts", () => {
  it("keeps automatic issuance bound to completed required courses and configured programme score", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_automatic_certificate_eligibility.sql"), "utf8");
    expect(migration).toContain("required_courses_incomplete");
    expect(migration).toContain("required_score_not_met");
    expect(migration).toContain("niu_program_completion_certificate");
    expect(migration).toContain("target_program.award_type <> 'certificate'");
    const grants = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_revoke_internal_certificate_function_execution.sql"), "utf8");
    expect(grants).toContain("revoke all on function public.niu_auto_issue_certificate_for_program_enrollment(uuid)");
    expect(grants).toContain("revoke all on function public.niu_program_completion_certificate_trigger()");
  });
  it("provides a protected printable learner transcript without degree claims", () => {
    const transcript = fs.readFileSync(path.join(root, "client", "src", "pages", "Transcript.tsx"), "utf8");
    expect(transcript).toContain("Learner transcript");
    expect(transcript).toContain("does not represent a degree transcript");
    expect(transcript).toContain("window.print()");
  });
  it("requires registrar authority and an audit reason when superseding a credential with a reissue", () => {
    const reissue = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_certificate_reissue.sql"), "utf8");
    expect(reissue).toContain("niu_is_registrar()");
    expect(reissue).toContain("A reissue reason of at least three characters is required");
    expect(reissue).toContain("status = 'superseded'");
    expect(reissue).toContain("credential_number");
  });
});
