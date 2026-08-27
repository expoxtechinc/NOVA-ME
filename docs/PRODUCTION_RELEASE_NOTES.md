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

The connected advisor review records one public and several authenticated `SECURITY DEFINER` notices. This is an expected consequence of NIU's database-enforced workflow controls, rather than an anonymous institutional-data exposure. Each listed function was rechecked against the live project: all use a fixed `search_path=public`; sensitive workflow functions have no `anon` execution grant; and their `authenticated` grants are limited to the roles needed for course enrollment, progress recording, role checks, grading, credential issuance, controlled publication, and record-preserving people governance. The sole anonymous function is `verify_niu_credential(text)`, which is deliberately retained for NIU's privacy-minimised public credential-verification route. The linter notices are retained as documented, deliberate exposures rather than suppressed.

Supabase still reports **Leaked Password Protection** as disabled. This is an Auth-account setting, not a database setting or application secret. The connected database tools do not expose a mutable control for it, and the browser session reaches the Supabase sign-in page rather than an authenticated NIU owner session. The linked Supabase organization was also verified to be on the **Free** plan, while Supabase documents leaked-password protection as a feature available on Pro and higher plans. It cannot therefore be enabled through NIU code, migrations, the connected tools, or the current vendor tier. It remains the sole documented platform-level hardening prerequisite for an authenticated project owner after the Supabase subscription and account access permit it, using [Authentication password security settings](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Release checklist

1. Configure at least one Super Administrator through the protected allowlist.
2. If the Supabase subscription is changed to a tier that includes the feature, enable leaked-password protection in the authenticated project dashboard and confirm the desired OAuth providers.
3. Publish reviewed programs and courses, then upload protected lesson documents or videos through the approved storage workflow.
4. Run a live role walkthrough using authorised student, instructor, registrar, and administrator accounts.

## Final validation evidence

After the Express 5.2.1 migration, the running development service was verified at both desktop and 375 px mobile widths for the public home page, programme catalogue, course catalogue, credential-verification page, and unauthenticated protected portal. Public routes rendered their approved empty states without exposing draft or restricted records, the credential-verification form remained available, responsive navigation remained usable, and the protected portal stopped at its approved sign-in boundary. The role-specific authenticated workflows remain covered by the passing route and authorization test suite; an interactive role walkthrough requires real approved identities and is listed in the launch checklist.

## Complete production audit — 26 August 2026

The latest audit confirmed that NIU’s public homepage, programme discovery, course discovery, credential verification, sign-in entry, and protected portal entry all render successfully. The local release gate passed its tests, TypeScript check, production build, and production dependency audit with no known production-package vulnerabilities.

The earlier Google `redirect_uri_mismatch` was resolved using the replacement Google Web client. The approved account `makealuckspam@gmail.com` now completes Google OAuth and reaches the NIU role-aware Super Administrator portal.

The current Supabase Security Advisor result contains one deliberately anonymous, privacy-minimised credential-verification function and the authenticated institutional workflow functions for enrolment, progress, grading, role checks, issuance, and status updates. These are the database-enforced interfaces required by the NIU platform, and their exposure is documented in the security model. The remaining Auth leaked-password-protection notice is limited by the linked Supabase Free tier as described above.

## Global access and resilience hardening — 26 August 2026

Google OAuth was completed with a replacement Google Web client and verified from Supabase authentication records. The approved account `makealuckspam@gmail.com` authenticated through Google and was provisioned with the `super_admin` NIU role. The client callback now accepts both Supabase’s already-established implicit sessions and code-based returns before loading the portal, so a valid login is not discarded simply because a browser returns without a PKCE code.

The portal now reloads its profile and institutional-role assignments whenever Supabase emits a delayed sign-in event, including browser refresh and token-restoration cases. It also clears local workspace state safely on sign-out. The application error boundary no longer renders stack traces to visitors; it presents a recoverable institutional message with safe retry and home-page actions instead.

At the delivery edge, Vercel now provides `nosniff`, frame-denial, restrictive referrer, and disabled unused-device-permission headers. The Supabase performance review identified 40 active unindexed foreign-key relationships. An additive migration created the covering indexes for all of them; a direct catalog check confirmed zero remaining unindexed foreign keys in the NIU public schema. The implementation preserves existing records, roles, row-level security policies, and certificate workflow controls.

## Existing-user governance — 27 August 2026

Super Administrators can now make record-preserving changes to an existing NIU profile through a narrow database function that checks the caller’s administrator role, prohibits self-role changes, synchronises the protected staff allowlist, writes a role-assignment record, and appends an audit event. Course-specific staff assignments are separate row-level-secured records, allowing an instructor, content author, assessor, grader, or registrar-support colleague to be assigned to a particular course without silently broadening their institutional role. Direct anonymous execution is revoked; the authenticated path is intentionally retained because it performs the internal role guard required by the protected Super Administrator interface.

## Accountable institutional administration — 27 August 2026

NIU now treats policy, institutional-structure, calendar, and core settings changes as governed records rather than unrestricted browser writes. Policy drafts retain their author; administrator approval, publication, and archival retain the reviewer and timestamp; and every policy mutation appends an audit event. Schools, departments, and academic-calendar events are created as non-public drafts by authorised staff, while a separate administrator-only workflow records review, publishing, or archival decisions with an audit event. Existing calendar events were retained as published when the status field was introduced, avoiding a visibility regression for previously public information.

Institution settings are now a protected singleton. An authorised administrator can initialize the first record from the NIU workspace, after which all changes flow through a guarded function that preserves the certificate-only scope, stores the acting administrator in `updated_by`, and writes an `institution_settings_saved` audit event. Direct table mutations are denied for policy pages, institutional publication states, and institution settings. The relevant database functions have no anonymous execution grant; authenticated grants are deliberately retained only because each function independently verifies the caller’s active administrator role.
