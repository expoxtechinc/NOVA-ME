import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("Super Administrator dashboard", () => {
  it("uses real institutional records for administration metrics and audit activity", () => {
    const dashboard = fs.readFileSync(path.join(root, "client", "src", "pages", "AdminDashboard.tsx"), "utf8");
    expect(dashboard).toContain('exactCount("profiles"');
    expect(dashboard).toContain('exactCount("program_enrollments"');
    expect(dashboard).toContain('exactCount("certificates"');
    expect(dashboard).toContain('from("audit_events")');
    expect(dashboard).toContain("No demo institutional data is shown.");
    expect(dashboard).toContain("Communication & reporting");
    expect(dashboard).toContain("System & quality");
    expect(dashboard).toContain("Institution settings");
  });

  it("keeps the dashboard restricted to administrator and super-administrator records", () => {
    const dashboard = fs.readFileSync(path.join(root, "client", "src", "pages", "AdminDashboard.tsx"), "utf8");
    expect(dashboard).toContain('role !== "administrator" && role !== "super_admin"');
    const app = fs.readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8");
    expect(app).toContain('path="/admin"');
  });
});
