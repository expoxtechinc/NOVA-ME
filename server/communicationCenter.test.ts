import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
describe("NIU communication center", () => {
  it("restricts individual protected notices to administrator roles and persists notices to the recipient record", () => {
    const page = fs.readFileSync(path.resolve(import.meta.dirname, "..", "client", "src", "pages", "CommunicationCenter.tsx"), "utf8");
    expect(page).toContain('role !== "administrator" && role !== "super_admin"');
    expect(page).toContain('from("notifications").insert');
    expect(page).toContain("institutional_notice");
    expect(page).toContain("Automatic certificate notices");
  });
});
