import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = path.resolve(import.meta.dirname, "..");
describe("NIU controlled programme bundle publication", () => {
  it("requires authorised database-side readiness checks before publication", () => {
    const migration = fs.readFileSync(path.join(root, "docs", "supabase", "20260827_niu_programme_bundle_publication.sql"), "utf8");
    expect(migration).toContain("niu_programme_bundle_readiness");
    expect(migration).toContain("niu_is_academic_staff()");
    expect(migration).toContain("required_lessons_with_material");
    expect(migration).toContain("niu_publish_programme_bundle");
    expect(migration).toContain("niu_is_administrator()");
    expect(migration).toContain("certificate programme must be approved");
    expect(migration).toContain("programme_bundle_published");
    expect(migration).toContain("revoke all");
    const publication = fs.readFileSync(path.join(root, "client", "src", "pages", "ProgrammePublication.tsx"), "utf8");
    expect(publication).toContain('rpc("niu_programme_bundle_readiness"');
    expect(publication).toContain('rpc("niu_publish_programme_bundle"');
    expect(publication).toContain("Publish complete bundle");
  });
});
