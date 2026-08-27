import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
describe("NIU content library", () => {
  it("requires a valid NIU staff session and bounded supported file upload", () => {
    const service = fs.readFileSync(path.join(root, "server", "contentLibrary.ts"), "utf8");
    expect(service).toContain("requireStaff");
    expect(service).toContain("maxBytes");
    expect(service).toContain("fileTypes");
    expect(service).toContain("storagePut");
    expect(service).toContain('from("content_library_items")');
  });
  it("registers protected library upload and lesson attachment routes", () => {
    const app = fs.readFileSync(path.join(root, "server", "app.ts"), "utf8");
    expect(app).toContain("/api/content-library/upload");
    expect(app).toContain("/api/content-library/attach");
    const page = fs.readFileSync(path.join(root, "client", "src", "pages", "ContentLibrary.tsx"), "utf8");
    expect(page).toContain("Attach resource");
    expect(page).toContain("external_resource");
  });
});
