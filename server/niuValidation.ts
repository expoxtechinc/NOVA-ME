export const NIU_CREDENTIAL_PATTERN = /^NIU-CERT-\d{4}-\d{6}$/i;

export function normalizeCredentialNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function isNiuCredentialNumber(value: string): boolean {
  return NIU_CREDENTIAL_PATTERN.test(normalizeCredentialNumber(value));
}
