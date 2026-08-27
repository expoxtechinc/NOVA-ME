import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("NIU starter programme recommendation", () => {
  it("offers a reviewed optional draft framework without auto-creating or publishing academic records", () => {
    const builder = fs.readFileSync(path.join(root, "client", "src", "pages", "InstitutionalBuilder.tsx"), "utf8");
    const recommendation = fs.readFileSync(path.join(root, "docs", "STARTER_PROGRAMME_RECOMMENDATION.md"), "utf8");
    expect(builder).toContain("Certificate in Digital Skills, Entrepreneurship, and Remote Work");
    expect(builder).toContain("Use recommended draft framework");
    expect(builder).toContain("it does not create, approve, or publish a programme");
    expect(builder).toContain('setStatus("draft")');
    expect(recommendation).toContain("not a pre-created or published programme");
    expect(recommendation).toContain("does **not** award a degree, licence");
    expect(recommendation).toContain("UNESCO");
    expect(recommendation).toContain("EntreComp");
  });
});
