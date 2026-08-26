import { describe, expect, it } from "vitest";
import { isNiuCredentialNumber, normalizeCredentialNumber } from "./niuValidation";

describe("NIU credential validation", () => {
  it("normalizes a valid credential number before lookup", () => {
    expect(normalizeCredentialNumber(" niu-cert-2026-000042 ")).toBe("NIU-CERT-2026-000042");
    expect(isNiuCredentialNumber(" niu-cert-2026-000042 ")).toBe(true);
  });
  it("rejects malformed and degree-like identifiers", () => {
    expect(isNiuCredentialNumber("NIU-DEG-2026-000042")).toBe(false);
    expect(isNiuCredentialNumber("NIU-CERT-2026-42")).toBe(false);
  });
});
