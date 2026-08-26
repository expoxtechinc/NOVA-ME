# Nova International University: Setup and Operations

## Operating scope

NIU is configured for **certificate programs only**. The institutional settings table accepts only `certificate_only` as its award scope, and the implementation does not create a degree-program, transcript, or degree-enrollment route. Future academic fields are present only to support a legitimate, separately authorised expansion.

> NIU must not publish accreditation, governmental recognition, degree-awarding authority, partnerships, faculty credentials, or affiliations unless each claim has been independently verified and formally authorised for publication.

## Required application configuration

Set the following values using the managed secret configuration, never by committing an environment file. The browser receives only the public Supabase endpoint and publishable key; **do not use a service-role key in the client**.

| Key | Use | Security requirement |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase API endpoint for NIU’s browser and server public client. | Public endpoint, not a privileged credential. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Row-level-security-aware publishable key. | May be exposed to the browser; policies must remain enabled. |
| `INITIAL_ADMIN_EMAIL` | Bootstrap administrator allowlist workflow. | Store only in managed server secrets; do not hardcode a personal address. |
| `APP_URL` | Canonical public URL for OAuth redirects and verification-link generation. | Update when the production domain changes. |

## Supabase authentication

Enable the Google provider in the Supabase Authentication settings and add the live NIU callback URL:

```text
https://your-niu-domain.example/portal
```

Google sign-in establishes identity only. An administrator must still place an approved address in `admin_allowlist` and assign a permitted role. Normal Google-authenticated users remain students by default. Do not create a public administrator-registration process.

## Storage and private learning materials

Create separate private buckets for course materials, submissions, certificates, faculty assets, and institutional branding. Store only object keys and metadata in the database. Private media should be delivered with short-lived signed URLs after an authorisation check; object paths must not be exposed as public content URLs.

| Resource type | Recommended access | Notes |
| --- | --- | --- |
| Course material | Enrolled student or staff | Verify active enrollment before signing access. |
| Assignment submission | Student owner plus assigned grader | Preserve submissions after grading; do not allow student edits to submitted attempts. |
| Certificate PDF | Credential recipient and authorised registrar staff | Permanent metadata record; issue a fresh signed link rather than public storage. |
| Branding assets | Authorised administrators | Use controlled replacement and retain audit history. |

## Credential issuance and verification

Credential numbers use the format `NIU-CERT-YYYY-000000`. The database assigns a unique number and stores status history. Certificate approval must remain a controlled registrar/administrator process:

```text
Learning completion → eligibility → administrative review → approval → credential registration → issuance → notification → verification
```

The public route is `/verify`. It returns only the credential number, approved public title/program fields, issue date, status, and recipient name only if the recipient has permitted disclosure. Revoked and superseded records retain their current status without exposing private academic records.

## Learning and assessment safeguards

The `niu_record_learning_progress` database function validates an authenticated learner’s active enrollment before recording activity progress. It maintains monotonic progress and server timestamps, preventing a browser from directly marking protected progress rows as complete. Assessments should enforce attempt limits, submitted-at timestamps, server-side grading rules, question randomisation, and immutable submitted responses. These controls are reasonable safeguards; NIU must not claim surveillance or perfect cheat prevention.

## Backup and recovery guidance

Use scheduled Supabase database backups, enable point-in-time recovery where the selected plan supports it, and maintain a protected export of migration files and certificate metadata. Test recovery on a non-production environment before relying on it.

| Asset | Recovery approach |
| --- | --- |
| Database schema | Apply reviewed version-controlled migrations in dependency order. |
| Academic and credential records | Restore from database backup; preserve audit and status-history records. |
| Files and certificates | Retain storage lifecycle/versioning and metadata keys; restore objects before reopening access. |
| Application configuration | Re-enter secrets through the managed secret interface; never restore them from source control. |

## Deployment and SEO

The app has PWA metadata, a robots file excluding private portal routes, basic page metadata, responsive layouts, keyboard-accessible controls, and reduced-motion handling. Before publishing, configure the canonical application URL, Google OAuth callback, Supabase production keys, storage policies, and a custom domain.

The project can use the platform’s managed hosting and custom-domain controls. If NIU later elects to deploy through Vercel, ensure the same environment values and Supabase redirect URLs are configured there; external hosting can introduce compatibility and operational differences.
