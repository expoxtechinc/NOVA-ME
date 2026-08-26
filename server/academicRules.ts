export type CertificateCandidateStatus = "ineligible" | "eligible" | "under_review" | "approved" | "rejected" | "issued";

export function canTransitionCandidateStatus(from: CertificateCandidateStatus, to: CertificateCandidateStatus): boolean {
  const transitions: Record<CertificateCandidateStatus, CertificateCandidateStatus[]> = {
    ineligible: ["eligible"],
    eligible: ["under_review", "rejected"],
    under_review: ["approved", "rejected", "eligible"],
    approved: ["issued", "rejected"],
    rejected: ["eligible"],
    issued: [],
  };
  return transitions[from].includes(to);
}

export function isValidAssessmentControl(passingScore: number, attemptLimit: number | null, timeLimitMinutes: number | null, weight: number): boolean {
  return Number.isFinite(passingScore) && passingScore >= 0 && passingScore <= 100 &&
    (attemptLimit === null || (Number.isInteger(attemptLimit) && attemptLimit > 0)) &&
    (timeLimitMinutes === null || (Number.isInteger(timeLimitMinutes) && timeLimitMinutes > 0)) &&
    Number.isFinite(weight) && weight >= 0 && weight <= 100;
}

export function isValidFinalScore(score: number): boolean {
  return Number.isFinite(score) && score >= 0 && score <= 100;
}

export function mayManageInstitution(role: "student" | "instructor" | "administrator" | "super_admin" | null): boolean {
  return role === "instructor" || role === "administrator" || role === "super_admin";
}

export function mayManageCredential(role: "student" | "instructor" | "administrator" | "super_admin" | null, registrarAssignment: boolean): boolean {
  return registrarAssignment || role === "administrator" || role === "super_admin";
}

export function mayReceiveProtectedMedia(activeEnrollment: boolean, materialPath: string | null): boolean {
  return activeEnrollment && Boolean(materialPath?.trim());
}

export function isPublicCredentialDisclosure(fields: string[]): boolean {
  const allowed = new Set(["credentialNumber", "status", "credentialTitle", "issuedAt", "recipientName"]);
  return fields.every((field) => allowed.has(field));
}
