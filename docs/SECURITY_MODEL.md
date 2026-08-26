# NIU Security and Academic-Control Model

Nova International University is configured as a **certificate-only** learning institution. The database model does not expose degree enrollment workflows. Certificate programs, prerequisite relationships, candidate approvals, credentials, assessments, and grades are individually protected by row-level access policies and controlled database functions.

## Identity and roles

NIU’s learning-platform records use Supabase authentication and the `profiles` role model. A new authenticated profile is provisioned with the **student** role by default. Entries in the protected `admin_allowlist` may grant `instructor`, `administrator`, or `super_admin` roles. Only a super administrator can manage that allowlist through the access-control workspace. A change is synchronized during profile provisioning and when an allowlist entry changes.

| Role | Core access |
|---|---|
| Student | Own enrollments, learning progress, grades, certificate eligibility, and issued credentials. |
| Instructor | Academic authoring, question banks, assessment preparation, submission review, and grade release. |
| Registrar | Candidate review, credential issuance, current-status review, and credential revocation. |
| Administrator | Institutional operations and protected configuration. |
| Super administrator | Administrator access plus allowlist management. |

## Academic and credential safeguards

Server-controlled database functions are used for high-risk actions. Learning activity completion requires an active enrollment. Course enrollment checks required prerequisite completions. Credential issuance requires an approved candidate, a valid score, and a linked program course. Grade release validates the submitted attempt, score range, staff authority, and assignment point ceiling. Revocation requires registrar authority and a recorded reason.

> Browser state is never accepted as proof of course completion, assessment completion, or credential eligibility.

Public credential verification is intentionally minimal. It accepts only normalized NIU credential numbers, rate-limits lookups at the application boundary, and returns the current credential status plus only the fields approved for public display. The protected learner credential page can render a print-ready certificate that includes a QR code back to the official verification page.

## Deliberate database-function exposure

NIU uses narrowly scoped `SECURITY DEFINER` functions where an RLS-only table operation cannot safely encode a multi-record academic action. Every such function fixes its `search_path` to `public`. Sensitive functions for enrollment, learning progress, grading, credential issuance and status changes, and role checks are executable only by the Supabase `authenticated` role and perform their own identity and role validation. The public `verify_niu_credential(text)` function is the sole anonymous exception: it exposes only the privacy-minimised verification result needed by the public verification route. The Supabase advisor appropriately reports these callable functions; the warnings document intentional gateways, not blanket access to underlying records.

> Supabase Leaked Password Protection is currently disabled in the linked project. This setting is controlled in an authenticated Supabase account session and cannot be enabled through NIU database migrations or application code. It is recorded in the production release notes as the remaining platform-level hardening action.

## Audit and records

High-impact changes to schools, departments, certificate programs, course versions, assessments, assignments, candidates, gradebook entries, credentials, and institutional settings are captured in the protected `audit_events` ledger. Credential status history is retained separately. Existing records were preserved through additive migrations only.

## Operational validation before launch

Before publishing the platform, a super administrator should sign in through the configured OAuth provider, establish at least one role-appropriate account for each operational function, and validate the following using real non-production records: prerequisite failure and success, learner lesson completion, assessment submission, faculty grading, registrar issuance, revocation, and public verification. Protected media delivery should use a production storage adapter and enrollment-checked signed access path before uploading instructional files.
