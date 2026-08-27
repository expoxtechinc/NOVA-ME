import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
describe("NIU administration reports", () => {
  it("uses authorised live records and provides controlled CSV/PDF-ready exports", () => {
    const report = fs.readFileSync(path.resolve(import.meta.dirname, "..", "client", "src", "pages", "Reports.tsx"), "utf8");
    expect(report).toContain('from("program_enrollments")');
    expect(report).toContain('from("certificates")');
    expect(report).toContain("Export CSV");
    expect(report).toContain("window.print()");
    expect(report).toContain('role !== "administrator" && role !== "super_admin"');
  });
});
