# NIU Production Readiness Notes

The current NIU release has been reviewed for runtime compatibility, protected data access, responsive public delivery, and production build integrity. The application maintains a **certificate-only** award scope and does not provide degree enrollment.

## Completed release controls

| Area | Implemented control |
|---|---|
| Server runtime and request parsing | The service now runs on Express 5.2.1. Its storage and SPA fallback routes use Express 5 named wildcards, while the API retains a simple query parser, 1 MB JSON and URL-encoded request limits, and a 100-parameter limit. Files are delivered through object storage rather than HTTP request bodies. |
| Application dependencies | Direct tRPC, HTTP-client, database, storage, query-parser, identifier, and chart packages were reviewed and brought to compatible maintained releases. The final production dependency audit reports **0 vulnerabilities** across 280 production dependencies. |
| Credential privacy | The public verification flow accepts normalized NIU credential numbers, applies application-level request throttling, and returns the minimum public credential record. |
| Learning protection | Enrollment checks, protected lesson access, signed object-storage links, and server-controlled learning-progress functions protect course activity. |
| Institutional controls | Administrator allowlisting, row-level policies, audit events, role-specific workspaces, credential lifecycle controls, and certificate-only database constraints remain active. |

## Supabase security-advisor review

The connected advisor review records one public and eight authenticated `SECURITY DEFINER` notices. This is an expected consequence of NIU's database-enforced workflow controls, rather than an anonymous institutional-data exposure. Each listed function was rechecked against the live project: all use a fixed `search_path=public`; sensitive workflow functions have no `anon` execution grant; and their `authenticated` grants are limited to the roles needed for course enrollment, progress recording, role checks, grading, credential issuance, and credential-status management. The sole anonymous function is `verify_niu_credential(text)`, which is deliberately retained for NIU's privacy-minimised public credential-verification route. The linter notices are retained as documented, deliberate exposures rather than suppressed.

Supabase still reports **Leaked Password Protection** as disabled. This is an Auth-account setting, not a database setting or application secret. The connected database tools do not expose a mutable control for it, and the browser session reaches the Supabase sign-in page rather than an authenticated NIU owner session. It therefore cannot be changed safely by this release automation. It remains the sole documented platform-level hardening action for an authenticated Supabase project owner to make in [Authentication password security settings](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Release checklist

1. Configure at least one Super Administrator through the protected allowlist.
2. Enable Supabase leaked-password protection in the authenticated Supabase project dashboard and confirm the desired OAuth providers.
3. Publish reviewed programs and courses, then upload protected lesson documents or videos through the approved storage workflow.
4. Run a live role walkthrough using authorised student, instructor, registrar, and administrator accounts.

## Final validation evidence

After the Express 5.2.1 migration, the running development service was verified at both desktop and 375 px mobile widths for the public home page, programme catalogue, course catalogue, credential-verification page, and unauthenticated protected portal. Public routes rendered their approved empty states without exposing draft or restricted records, the credential-verification form remained available, responsive navigation remained usable, and the protected portal stopped at its approved sign-in boundary. The role-specific authenticated workflows remain covered by the passing route and authorization test suite; an interactive role walkthrough requires real approved identities and is listed in the launch checklist.
