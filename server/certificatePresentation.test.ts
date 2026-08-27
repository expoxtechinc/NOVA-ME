import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("NIU certificate presentation", () => {
  it("includes the approved founder signature and verification information in the printable credential", () => {
    const certificate = fs.readFileSync(path.resolve(import.meta.dirname, "..", "client", "src", "pages", "CertificatePrint.tsx"), "utf8");
    expect(certificate).toContain("akinssokpah");
    expect(certificate).toContain("Akin S. Sokpah — President and Founder");
    expect(certificate).toContain("Official verification");
    expect(certificate).toContain("QRCodeSVG");
  });
});
