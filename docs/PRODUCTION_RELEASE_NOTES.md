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

## Public student registration — 27 August 2026

Verified visitors can now create an NIU account through the public email-link flow or an available Google sign-in. The prior Auth-level allowlist gate was removed, while the profile-provisioning trigger continues to give every non-allowlisted account the `student` role. Faculty, registrar, administrator, and Super Administrator access remain separate staff decisions: they cannot be obtained through public registration. Direct profile table updates are now denied, including an account’s role and account status; status changes use a guarded, audited Super Administrator function. The email-link flow has been deployed; its final delivery-and-return exercise remains a real-user launch check. New Google registrations also remain subject to the Google OAuth consent configuration controlled by the Google client owner.

## First protected original study guide — 27 August 2026

This release adds a narrow Super Administrator action for NIU’s first original draft study guide, **Digital Foundations: Access, Information, and Responsible Study**. The action is available only after an active Super Administrator signs in, locates the already-authorised first Digital Foundations module and lesson, stores the Markdown guide as a private object-storage file, registers metadata only in `content_library_items`, and attaches it as a required item through `lesson_content_items`. It does not publish the guide, lesson, course, or programme; it creates no learner, enrolment, assessment, or public listing.

The action is idempotent for the defined NIU resource and attachment. A narrow `SECURITY DEFINER` audit function verifies that the exact study-guide category, filename, required attachment, course, module position, and lesson position are present before it records `digital_starter_study_guide_initialized`. It has `search_path=public`, has no anonymous execution grant, and requires an active Super Administrator internally. The endpoint rejects unauthenticated calls, and the existing protected lesson-note route was repaired to preserve the live permitted lesson kind rather than writing an invalid `document` kind.

The first real owner-authorised storage and attachment event remains a live Super Administrator validation task. The programme continues to be a draft-only certificate offering until NIU’s existing readiness and publication workflow approves a complete bundle.

## Production protected-storage repair — 27 August 2026

The first owner attempt confirmed that Vercel’s serverless endpoint returned a generic function-invocation error before the protected handler could respond. The Content Library’s production path has therefore been moved from that unavailable serverless storage route to Supabase Storage, which is already the live identity and policy authority for NIU. The `niu-learning-materials` bucket is explicitly private, limited to 10 MB files and NIU’s approved material MIME types. Academic staff can upload only within a folder named for their authenticated identity. The application still stores only the object path and metadata in the database, never file bytes.

Object retrieval is controlled through a Supabase row-level policy: authorised academic staff may review materials, while a learner may request a short-lived signed URL only when an active or completed enrollment is linked to the course containing the attached resource. Content Library item and lesson-attachment changes now also invoke the existing NIU audit trigger. The new workflow preserves category-specific MIME validation in the interface and does not make the starter guide public.

## Public discovery and first certificate release repair — 27 August 2026

NIU’s programme and course catalogue pages no longer depend on the Vercel server function that previously returned a generic discovery error. They query Supabase directly, using the existing published-only row-level policy for `certificate_programs` and `courses`. Programme and course detail pages use the same published-only constraint. Draft records therefore remain invisible to visitors even when public discovery is operational.

The composite-key audit-trigger error encountered during the first study-guide attempt has been repaired with a dedicated security-definer trigger function. It uses the library item identifier for `content_library_items` and the attached content-item identifier for `lesson_content_items`; it records before/after metadata without assuming an `id` field exists on every table.

A new Super Administrator-only **Controlled certificate release** page provides a single deliberate action for the owner-authorised first programme. It stores four original NIU Markdown study guides privately, attaches one guide to each required lesson, invokes a narrow audited approval function that requires exactly four modules, four required lessons, and four material attachments, then calls the existing administrator-only certificate-bundle publication gate. It creates no learners and makes no degree, accreditation, licensure, recognition, partnership, or employment claim. The owner’s live action and post-publication verification remain the final release evidence.

## Controlled release status-model compatibility repair — 27 August 2026

The first live controlled-release attempt confirmed that the course-status enum was missing the existing workflow’s `approved` stage, although programme, module, lesson, readiness, and publication controls correctly require it. NIU now adds `approved` non-destructively between `review` and `published` in `course_status`; no existing course record was changed. The strict approval gate, its exact active Super Administrator check, material prerequisites, audit event, and existing certificate-only publication function remain unchanged. Aggregate verification confirmed four modules, four required lessons, four attached original study guides, and the complete permitted course status sequence before the owner’s release retry.

## Verified first certificate launch — 27 August 2026

The owner-authorised controlled release has now completed. **Certificate in Digital Skills, Entrepreneurship, and Remote Work** and its required course, **Digital Foundations for Enterprise and Remote Work**, are published and visible through NIU’s public programme and course routes. The launch verification confirmed that all four modules and all four required lessons are published; four original NIU study guides are attached; the private `niu-learning-materials` bucket remains non-public with a 10 MB limit; and one `digital_starter_bundle_approved` event and one `programme_bundle_published` event are recorded.

The programme-detail relationship policy was then separated from staff-only authorization logic, allowing anonymous visitors to read only the programme-course relationship for a published programme. It does not expose draft relationships, protected files, learner data, or the staff authorization helper. The first course’s published descriptions were also updated to remove now-inaccurate draft wording. A real enrolled learner retrieval exercise remains a separate validation task; the public site does not expose study-guide files.

## Student enrolment type compatibility repair — 27 August 2026

The first real student-enrolment attempt correctly reached NIU’s protected database function but exposed an old type mismatch: its status literals were treated as text while the live `enrollments.status` column uses the `enrollment_status` enum. The function now casts the `active` and `completed` values explicitly to the live enum. It still requires an authenticated active NIU account, a published course, completed prerequisites where applicable, and authenticated-only execution. No enrolment was created by the failed attempt.

The authorised student retry has since produced one active student enrolment for the published first course. The learner’s protected course page displayed the first attached private study guide and the server-verified lesson-completion state. The original popup action generated no visible signed-link error; NIU was therefore changed to direct same-tab navigation after signed-URL creation with an **Opening protected resource…** status. The owner then deployed this change and performed the learner action again. The private study guide opened successfully in the enrolled Android learner session, proving that the attachment, active-enrollment policy, signed URL, and private-object retrieval path work together without exposing the material through the public catalogue.

The returned guide text revealed an older malformed-punctuation issue (`â€”` and `â€™`) in that previously stored object. It does not weaken storage privacy or access authorization, but it is a learner-facing quality defect. NIU now includes a Super Administrator-only maintenance action that writes corrected replacement bytes to a new private object and updates only the existing content-library record’s `storage_path`. The course, lesson attachment, enrolments, publication state, and enrolled-only retrieval policy remain unchanged; the existing automatic content-library audit trigger records the metadata change. One owner-authorised maintenance action and a short learner re-open check remain before the typography repair is closed.


## Unified Course Studio — 27 August 2026

NIU now includes a unified `/course-studio` administrator workspace and a primary Admin Dashboard entry for it. The responsive workspace uses a three-pane layout: a curriculum tree on the left, a main editor in the centre, and a progress and quality checklist on the right. It creates real draft certificate programmes, courses, course versions, programme-course relationships, ordered modules, and lessons without redirecting during those core authoring steps.

Course Studio preserves the existing certificate-only award constraint, NIU founder strings, academic-staff authorization boundary, private object-storage model, audit and version records, and reviewer-authorised publication gate. It also surfaces governed panels for protected learning content, assessments, grading and completion rules, certificate design, read-only learner preview, validation, and publication. Existing specialist content and assessment editors remain available while their full mutation controls are consolidated into later Course Studio iterations; no specialist editor is bypassed or duplicated.

The implementation passed the complete Vitest suite, TypeScript check, production build, and `pnpm audit --prod` with no known production-package vulnerabilities. The build retains the existing large-client-chunk warning. Authenticated Super Administrator and mobile responsive production walkthroughs remain required after this release is deployed; this UI release does not modify live academic records.


## Certificate eligibility and issuance control — 27 August 2026

NIU now separates automatic eligibility calculation from credential issuance. When a protected programme enrolment reaches verified completion, the database workflow checks required-course completion and released-grade performance and creates or refreshes an `eligible` certificate-candidate record. It no longer inserts an active certificate without institutional review. A registrar, administrator, or Super Administrator must review and approve the candidate through an audited state-transition function, then issue the certificate through the existing protected issuance function. Duplicate active, pending, and superseded credentials remain blocked.

Learners can see their protected eligibility state, issued certificate records, and transcript through My NIU. The certificate is a print-ready institutional completion record containing the learner name, certificate title, unique credential number, issue date, learning hours, QR verification link, current status, and the exact approved founder strings `akinssokpah` and `Akin S. Sokpah — President and Founder`. The transcript is a protected NIU certificate-learning record and may be printed or saved by the learner. Neither artifact is represented as a degree, professional licence, accreditation, government recognition, transfer-credit guarantee, employment guarantee, or universally accepted credential; external organisations must independently determine whether to recognise it.

A recommendation letter is not generated automatically. If NIU provides one, it must be authored or approved by an authorised institutional officer, based only on documented learner records, and labelled as an NIU institutional letter rather than a guarantee of employment, licensure, accreditation, or acceptance. This protects learners from fabricated claims while leaving room for a separately governed document workflow.


## Eligibility source-of-truth repair — 27 August 2026

A live dashboard comparison identified that the learner-facing My Learning workflow uses `enrollments`, while an earlier compatibility helper listened only to `program_enrollments`. NIU now recalculates certificate candidates from the actual course-enrolment and released-grade records used by learners, using database triggers on course completion and grade release. It creates an `eligible` candidate only when every required course and the configured score rule pass, and still requires an authorised registrar or administrator to approve and issue the certificate. The internal recalculation helper has no public or arbitrary-authenticated execution grant.

The current live learner record is active with 0% verified course activity, so zero candidates and zero certificates are the correct state. No credential has been created or promised. A certificate becomes available only after the learner completes the governed course requirements, grades are released where required, and institutional review approves the resulting candidate.


## Fresh-start archive state — 27 August 2026

At the owner’s request, the unfinished first certificate bundle, **Certificate in Digital Skills, Entrepreneurship, and Remote Work**, and its course, **Digital Foundations for Enterprise and Remote Work**, were moved from `published` back to `draft` through the authorised Supabase project. This is a reversible archive/unpublish action: it removes both records from published-only public discovery while preserving the course, modules, lessons, private learning materials, enrolment history, audit history, and administrator restoration path. No credential was issued and no learner or owner account was changed.

The connected live verification reports one draft programme, one draft course, zero published records for that bundle, one active learner course enrolment at 0% verified progress, zero certificate candidates, and zero issued certificates. This is the intended fresh-start baseline. NIU’s certificate workflow remains administrator-controlled and does not promise accreditation, transfer credit, licensure, employment, or universal recognition.


## Public contact controls — 27 August 2026

NIU’s shared public site shell now presents a dedicated **Contact NIU** area in the footer with accessible icon-and-label links for WhatsApp (`+231 760 030 163` via `https://wa.me/231760030163`), email (`aki.sokpah.link@gmail.com` via `mailto:`), and Facebook (`https://www.facebook.com/share/1Dj6oYFsdv/`). External WhatsApp and Facebook links open in a separate tab with a safe `noreferrer` relationship; the email control uses the device’s mail handler. Each control includes a descriptive accessible label and the email address remains readable on narrow screens.

The contact controls were checked on the public home and contact routes at desktop and 375 px mobile widths. The focused regression test passed, TypeScript passed, the production build completed, and the production dependency audit reported no known vulnerabilities. The full suite passed 71 of 72 tests; the only failure was the pre-existing live Supabase settings probe timing out because the configured endpoint returned no response within the test window. A direct `curl` check reproduced the same timeout, so no contact-control regression was indicated.


## Phone-friendly validation boundary — 27 August 2026

The NIU sign-in route is usable from a phone: it offers Google authentication and a secure email account-link form, and every newly provisioned account is server-defaulted to the student role. Automated source and route checks confirm that self-registration cannot self-elevate to staff access. A real email-link registration still requires opening the one-time message from the test inbox, and People Governance plus protected learning-note maintenance require an authenticated authorised session; those actions are intentionally not simulated or marked as completed without real evidence.


## Governed Question Bank — 27 August 2026

NIU’s assessment authoring workspace now provides a private Question Bank workflow. Academic staff can create and edit empty banks and draft questions with multiple-choice answer choices, a selected correct answer, difficulty, topic, learning-objective mapping, points, explanations, and approval status. Registrar, administrator, and Super Administrator roles can approve complete questions; the database rejects invalid multiple-choice keys, non-positive points, unauthorised approval, and assessment attachment of anything other than an approved question.

Question Bank, question, and assessment-attachment mutations remain behind the existing academic-staff RLS boundary and are recorded through the NIU audit ledger. The migration is additive and created no banks, questions, assessments, or programme content. Existing curriculum and assessment records were not modified. The UI includes explicit empty-state guidance and keeps drafts private and unpublished until governed review.


## Future academic assessment governance — 27 August 2026

NIU now applies an additive, opt-in governance layer to future Course Studio records. New programmes, courses, modules, lessons, learning resources, question banks, questions, and assessments created by Course Studio are explicitly marked for the draft-first lifecycle: Draft → Review → Approved → Published → Archived. New records begin in Draft; direct status jumps, reopening published or archived records, non-administrator approval/publication, and assessment attachment of unapproved questions are rejected with explanatory database errors. Existing rows remain outside the new opt-in flag and were not reclassified, deleted, or edited.

Future assessments persist completion rules and are blocked from approval or publication when passing score, positive time limit, positive attempt limit, required completion rules, or approved attached questions are missing. Assessment titles are protected by a future-only course/module duplicate key, and Course Studio performs a NULL-safe duplicate preflight with a clear reuse warning. Question validation requires positive points, complete review metadata, and valid multiple-choice answer keys. Governed transitions and supported entity mutations retain NIU audit-trigger capture; protected learning resources remain in private storage.

The future certificate-template table is empty by design, and no question, assessment, programme, course, module, lesson, learning-resource, or certificate-template records were created by the migrations. Live verification reported zero governed records and zero certificate-template rows. Focused governance tests, the complete regression suite, TypeScript check, production build, and production-scope dependency audit passed. The development dependency audit continues to report upstream toolchain advisories; deployed production dependencies report no known vulnerabilities. Responsive verification at 375×812 confirmed restricted staff routes remain readable and non-overlapping without requiring live academic data.


## Curriculum Import — 27 August 2026

NIU now includes an administrator-only **Import Complete Curriculum** action inside the guided academic package workflow. Approved Markdown and plain-text curriculum sources are uploaded to the private `niu-learning-materials` bucket, recorded as an audited import job, and analyzed deterministically from explicit source labels. The analyzer preserves course/module/lesson ordering and relationships, extracts explicit objectives, activities, knowledge checks, assessments, final examinations, certificate settings, and supported difficulty values, and records missing information instead of inventing academic content. Unsupported binary formats are refused rather than guessed.

The explicit generation action creates only new draft records for the imported department, certificate programme, ordered courses, course versions, modules, lessons, question banks, assessments, and final examinations. Generated records remain private and unpublished; no approval or publication is automatic. Generation is blocked until required source information is present and valid, including a selected school relationship, programme description, course descriptions, module difficulty, lesson objectives and activities, and explicit assessment/certificate information. Duplicate department/programme codes, duplicate source course titles, and duplicate module titles are caught before insert with clear explanations. Existing records and published curriculum are never edited or deleted.

The import review screen shows upload/analyze/generate/review stages, source text, detected counts and ordering, validation errors, missing-information markers, and a regenerate-incomplete-sections action. Generated learning activities and explicit knowledge-check statements are retained in draft lesson metadata for individual correction in Course Studio. Imported resources remain governed by the existing private-storage and enrolled-learner access policies; approval and publication continue through existing authorised NIU gates. The live migration created no import jobs or academic records. Curriculum Import focused tests, the full regression suite, TypeScript check, production build, production dependency audit, and mobile protected-route verification passed.


### Curriculum Import policy repair — 27 August 2026

The first Curriculum Import implementation exposed a policy mismatch: the interface stores the uploaded source and its deterministic analysis in one `generated` import-job row, while the initial insert policy permitted only `uploaded`. The policy was repaired additively to permit only the pre-approval states `uploaded`, `analyzing`, `generated`, and `validation_failed`, while retaining the authenticated academic-staff guard and `created_by = auth.uid()` check. Review, approval, and publication states cannot be created through the initial insert path. No import job or academic record was created by the repair.

## Lesson Builder and Programme Builder hardening — 31 August 2026

The live `public.lessons` constraint was inspected directly. The permitted `kind` values are `article`, `video`, `flashcards`, `quiz`, `test`, and `final_exam`; the Lesson Builder and Course Studio now expose only those database-valid values, while AI package generation defaults to `article` rather than an invalid `reading` value. Accessibility fields, captions, transcripts, required status, points, and governed draft status remain intact. No constraint was weakened and no existing lesson was modified.

The preferred `/programme-builder` route now presents the unified certificate-only authoring workspace, while `/course-studio` remains as a compatibility route. New Course Studio modules and lessons, and future AI-generated draft packages, receive explicit `program_modules` and `program_lessons` scope links. Programme readiness and publication evaluate only those selected package relationships. The mobile workflow uses sequential step unlocking, private browser draft autosave, editable completed steps, and authorised publication handoff; saving does not publish.

Validation for this release passed 39 test files and 96 tests, TypeScript, and the production build. The build retains only the existing non-blocking chunk-size advisory. The live NIU-IT-CDL scope verification returned one attached course, one scoped module, one scoped lesson, and one lesson with a permitted kind. No programme was published and no academic records were deleted or altered.

## People Governance account-status control — 31 August 2026

Super Administrators now have a dedicated People Governance control for changing an existing NIU account between `active`, `suspended`, and `inactive`. The interface calls the existing guarded `niu_update_profile_account_status` function rather than writing directly to `profiles`; the function retains its active-Super-Administrator check, valid-status validation, self-suspension protection, and audit event. Role reassignment and scoped course assignments remain separate governed actions. Focused People Governance and self-service-registration tests pass, as does the complete TypeScript and production-build validation. Real owner-session walkthrough evidence remains tracked separately and no existing account, academic record, or publication state was changed by this release.

## Vercel API bootstrap repair — 1 September 2026

The live Vercel runtime logs identified the remaining production failure precisely: `ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/server/app.ts' imported from /var/task/api/index.js`. Vercel had emitted an unbundled TypeScript local import, so the API function failed before Express could handle tRPC requests. The repair preserves the readable `api/index.source.ts` implementation for tests, generates a single bundled `api/index.js` during every production build, and points `vercel.json` at that unique JavaScript function path. A conflicting duplicate `api/index.ts` path was removed.

Commit `f290ea0` deployed successfully to the linked NOVA-ME Vercel project. The live custom domain `novainternationaluniversity.vercel.app` now reports the current build SHA from `/api/healthz`. A public malformed request to the actual `aiBuilder.createPlan` route returns a JSON 405 response, and an unknown procedure returns a JSON 404 response; neither returns the former plain-text `FUNCTION_INVOCATION_FAILED`. The owner-authenticated blueprint save, research-review, student registration, protected upload, and learner retrieval exercises remain separate evidence-gated workflows and have not been falsely marked complete.
