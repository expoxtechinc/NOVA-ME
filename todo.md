# Project TODO

- [x] Define certificate-only role, content, learning-progress, assessment, and credential domain models with degree enrollment explicitly disabled.
- [x] Extend the database schema with normalized institutional, academic, enrollment, assessment, certificate, notification, and audit-log tables plus integrity constraints and indexes.
- [x] Implement server-side authorization helpers, administrator allowlist checks, role-aware protected procedures, input validation, audit capture, and rate-limited public credential lookup.
- [x] Build public NIU navigation, responsive institutional pages, program and course discovery, search, support resources, policy pages, accessible PWA metadata, and SEO configuration.
- [x] Build privacy-preserving public credential verification by credential number, including active, revoked, and superseded status states.
- [x] Build public program and course detail experiences that disclose certificate-only offerings without unsupported accreditation, recognition, partnership, faculty, or degree claims.
- [x] Build reusable responsive dashboard foundations and role-specific student, faculty, registrar, and administrator entry points with meaningful empty, loading, and error states.
- [x] Build student learning-path views with prerequisite-aware enrollment, server-validated lesson activity completion, protected content entries, personal grades, and certificate eligibility status.
- [x] Build administrator and faculty workspace views for schools, departments, certificate programs, courses, modules, lessons, question banks, assignments, announcements, calendar events, content review, versioning, and previews.
- [x] Build assessment and grading foundations supporting question banks, quizzes, module tests, final assessments, attempt rules, weighted grading, automatic/manual grading, and immutable submitted attempts.
- [x] Build certificate candidate review, administrative approval, unique credential registration, downloadable certificate records, QR verification links, status history, revocation records, and student retrieval history.
- [x] Add configurable institutional branding, certificate templates, grading scales, completion rules, and future-ready academic fields while blocking degree enrollment actions.
- [x] Add privacy, accessibility, responsive design, secure-media, backups guidance, environment example, and deployment-readiness documentation.
- [x] Write and run Vitest coverage for authorization, credential verification privacy, certificate-only program rules, learning-progress validation, and credential status transitions.
- [x] Verify public, student, faculty, registrar, and administrator flows on desktop and mobile; review server logs and resolve critical errors.
- [x] Save a final checkpoint with all completed work marked accurately in this tracker.
- [x] Extend the existing Online University Supabase project only through additive, data-preserving migrations, retaining its existing profiles, allowlist entries, and learning records.
- [x] Create separate faculty, registrar, and administrator dashboard entry routes with role-specific navigation, empty states, and access gating instead of a generic staff workspace.
- [x] Add a committed non-secret environment configuration reference documenting all required public-client and server environment keys.
- [x] Add route checks or tests confirming each role reaches its intended dashboard entry point and cannot access an unauthorised role workspace.
- [x] Implement and test administrator allowlist enforcement plus role-protected server procedures for staff-only operations.
- [x] Add prerequisite-aware enrollment checks and a signed protected-media delivery flow for enrolled learners.
- [x] Build department, certificate-program, lesson, content-review, version-management, and preview workflows for authorised staff.
- [x] Add full assessment lifecycle controls, immutable submissions, grading actions, and released-grade workflows.
- [x] Add credential revocation management/history and student credential retrieval-history views.
- [x] Add configurable certificate templates, grading scales, and completion-rule management.
- [x] Add authorised draft and published previews for certificate programs, lessons, and course-version snapshots.
- [x] Expand course-version management with an existing-version review list and controlled status changes.
- [x] Add access-route checks for institutional builder and preview/version-management workspaces.
- [x] Add integration-style coverage for authorization, credential privacy, progress validation, and credential status transitions.
- [x] Exercise authenticated student, faculty, registrar, and administrator workflows on desktop and mobile after OAuth role provisioning.
- [x] Audit the latest NIU release for deploy-blocking configuration, accessibility, security, and workflow gaps.
- [x] Refine confirmed production-readiness gaps without altering existing academic records, including Express 5 wildcard-route compatibility and maintained runtime upgrade.
- [x] Re-run public, role-access, responsive, security-advisor, test, type-check, and production-build validation after the Express 5 runtime upgrade.
- [x] Save and deliver the final production-readiness release checkpoint (version 8afc3345).
- [x] Resolve the compatible Express dependency audit findings through the Express 5.2.1 runtime upgrade and record the zero-vulnerability production audit result.
- [x] Verify and document that Supabase leaked-password protection cannot be enabled in the current NIU environment: the linked organization is on the Free tier, the feature requires Pro or higher, and connected tools have no authenticated Auth-setting control.
- [x] Reassess SECURITY DEFINER advisor notices and retain only deliberately exposed, narrow-scope functions required by NIU workflows.
- [x] Complete all production-readiness actions available through connected project and database tools without requiring user-side configuration work.
- [x] Document the isolated Supabase Auth setting that remains account-session-only because the connected tools cannot change it safely.
- [x] Record post-Express-5 public-route, protected-route, and mobile responsive validation evidence for the final release.
- [x] Inspect the NOVA-ME repository, current NIU browser branding, and Vercel deployment configuration.
- [x] Add a production browser icon and complete search-preview metadata using the approved NIU branding asset.
- [x] Validate the Vercel deployment configuration, production build, and repository history before pushing.
- [x] Push the complete branded NIU release to expoxtechinc/NOVA-ME and document the Vercel deployment hand-off.
- [x] Provide the user with the verified manual Vercel deployment procedure for the pushed NOVA-ME release.
- [x] Correct the Vercel TypeScript build failure caused by incompatible Express type resolution and republish the NIU release.
- [x] Correct the Vercel deployment that responds with bundled server source instead of the NIU website, then republish and verify the repair.
- [x] Configure and verify the deployed NIU Google sign-in connection for approved role-aware access.
- [x] Audit all connected-service options for registering NIU’s Google OAuth callback without requiring user-side technical work; only the authenticated Google Cloud OAuth-client owner can register the required callback.
- [x] Provide the owner-facing step-by-step Google Cloud OAuth callback procedure for completing NIU Google sign-in.
- [x] Complete a full production audit of NIU’s deployed routes, repository, Vercel build, Supabase integration, and Google sign-in path; remediate all accessible issues. The Google OAuth client callback remains a separate authenticated-owner prerequisite.
- [x] Add and validate a server-enforced email-link sign-in fallback so only approved NIU users can access the platform while Google OAuth callback registration remains pending.
- [ ] Verify a real self-service student email-link registration, live portal return, and student-only access while confirming the workflow cannot self-elevate to staff roles. Owner reported completion from a phone; automated authorization tests confirm no self-elevation, but inspectable session evidence is still required.
- [x] Enable public email-link registration with an enforced student-default profile role and a separately controlled staff-elevation process.
- [ ] Correct Supabase email-link redirect settings so NIU authentication returns to the live Vercel portal instead of localhost.
- [x] Repair and verify NIU’s primary Google OAuth sign-in redirect configuration for the live Vercel portal.
- [x] Provision makealuckspam@gmail.com as an NIU Super Administrator and prepare it as the clean Google OAuth ownership path.
- [x] Repair and verify NIU’s post-Google OAuth session return to the role-aware portal.
- [x] Add and validate a dedicated NIU OAuth callback route that exchanges the authorization code before redirecting to the portal.
- [x] Trace the live Google OAuth return behavior and repair the verified Google-client secret and client callback session handling that previously prevented a portal session.
- [x] Inspect and resolve the live Supabase callback redirect that reaches `/auth/callback` without a usable authorization code after provider exchange.
- [x] Audit NIU’s global deployment, browser resilience, authentication continuity, production security, and performance for remaining high-value hardening gaps.
- [x] Add browser-safe authentication recovery so user navigation, refreshes, and implicit Google OAuth session returns cannot strand a valid NIU session.
- [x] Verify the live Google sign-in reaches `/portal` with an active NIU session after the browser-recovery release.
- [ ] Run an end-to-end production Super Administrator learning-note upload and confirm protected learner-only retrieval before declaring the workflow fully verified.
- [ ] Complete the final production-wide validation after the live learning-note upload workflow is verified, then record the pushed global-reliability release.
- [x] Map every requested NIU administration requirement to an implemented workflow, a safe scope decision, or a documented future phase without leaving unreviewed gaps.
- [x] Validate the Super Administrator dashboard against the requested real-record metrics, recent activity, alerts, and complete domain navigation.
- [x] Complete governed university, school, department, academic calendar, policy, branding, and configuration administration with relevant accountability and publication controls.
- [x] Complete course and programme administration fields for outcomes, difficulty, duration, requirements, templates, status, relationships, and supported visual/media references.
- [x] Complete a reusable protected content library for approved documents, presentations, images, audio, video, research materials, study guides, and external learning references.
- [x] Complete module and lesson authoring metadata for objectives, estimated time, required status, points, supported materials, captions/transcripts, and governed publication.
- [x] Complete configurable video, reading, flashcard, question-bank, quiz, assignment, test, and assessment rules without relying solely on client-reported completion.
- [x] Complete configurable points, grading, attempt, late-rule, completion-rule, and certificate-eligibility management using server-validated outcomes.
- [ ] Complete protected student, faculty, and administrator record-management controls, including end-to-end validation across account status, role, and assignment management.
- [x] Add and validate explicit Super Administrator controls for existing-user role reassignment and scoped staff assignments with record-preserving server authorisation.
- [x] Complete certificate approval, issuance, reissue, revocation, credential verification, transcript retrieval, and automatic eligibility workflow without unsupported recognition claims.
- [x] Add the approved NIU founder-signature presentation to certificate output using the exact signer text `akinssokpah` and `Akin S. Sokpah — President and Founder`.
- [x] Complete governed notifications, announcements, reports, audit activity, and CSV/PDF export workflows based only on authorised institutional records.
- [x] Create a dependency-aware NIU programme-package workspace that guides authorised staff through department, certificate programme, course, module, lesson, and protected material setup in order.
- [x] Show real-record package readiness, missing prerequisites, and context-aware recommended next actions without creating placeholder academic content.
- [x] Add a server-validated controlled publication action that can release an approved NIU programme bundle only after its contained courses, modules, lessons, and required materials meet readiness rules.
- [x] Validate and deploy the guided programme-package authoring and publication workflow.
- [x] Add an ordered NIU module blueprint that makes Module 1, Module 2, and onward course structure clear to administrators.
- [x] Add context-aware recommendations for each module’s objectives, lessons, protected notes/materials, assessment, learner-support, and review requirements without auto-creating academic content.
- [x] Validate and deploy the enhanced module blueprint within the guided programme package workflow.
- [x] Support unlimited ordered NIU modules within each course, with a configurable learning level and module-specific objectives, lessons, protected notes, media, assessment, and support requirements.
- [x] Validate and deploy the scalable level-aware course-module architecture without changing NIU’s certificate-only academic scope.
- [x] Organise the Super Administrator navigation around the requested institutional, academics, people, records, communication, reporting, and system domains.
- [x] Add non-destructive covering indexes for the 40 verified unindexed NIU foreign keys identified by the Supabase performance advisor.
- [x] Correct core-role reassignment so it never writes constrained institutional-role values, while retaining auditable approved-identity synchronization.
- [x] Correct programme-readiness and module-builder content-attachment references to NIU’s protected `lesson_content_items` junction.
- [x] Implement and verify a protected policy-administration workflow for `policy_pages`, including accountable author/reviewer records and staged publication controls.
- [x] Extend the protected certificate-programme builder to manage programme objectives/outcomes, difficulty, completion requirements, certificate template, and approved visual/media reference fields.
- [x] Document and test staged publication or intentional direct-administration safeguards for schools, departments, academic calendar, and institution settings before closing the broader institutional-governance tracker item.
- [x] Add audited administrator-only publication controls for schools, departments, and academic-calendar records while preserving existing public calendar visibility.
- [x] Initialize the single protected NIU institution-settings record through an accountable administrator workflow and record every approved configuration update.
- [ ] Perform and document an end-to-end Super Administrator People Governance validation using real authorised records without altering the owner account.
- [x] Allow any legitimate visitor to create an NIU student account through a secure self-service sign-up flow, while preserving separate controlled staff-role approval.
- [ ] Verify one real self-service student registration and its student-only portal access before declaring public registration fully validated. Owner reported completion from a phone; sandbox browser session was separate and could not independently observe the authenticated state.
- [x] Remove direct self-updates to NIU profile records so public student registration cannot be used for role or account-status escalation.
- [x] Prepare the first certificate-only NIU programme framework: Digital Skills, Entrepreneurship, and Remote Work, with a controlled publication path and no unsupported employment or recognition claims.
- [x] Add an audited Super Administrator one-tap setup that creates the approved first school, department, certificate programme, and draft course without publishing content.
- [x] Repair the starter-programme setup function’s ambiguous `program_id` reference and revalidate the owner-authorised draft creation.
- [x] Add an audited Super Administrator one-tap setup that creates the recommended ordered starter module outline as draft records for NIU’s first course.
- [x] Add an audited Super Administrator one-tap setup that creates the recommended draft lesson scaffold for NIU’s first course without adding materials, assessments, learners, or public content.
- [x] Repair the starter lesson scaffold to use only NIU lesson activity types permitted by the live `lessons_kind_check` constraint, then revalidate owner-authorised creation.
- [x] Add an original NIU Digital Foundations study guide as a private draft resource and attach it to the authorised first lesson without publishing it.
- [x] Repair NIU’s protected learning-note upload handler so it never writes a lesson type that violates the live `lessons_kind_check` constraint.
- [x] Enforce an auditable, active-Super-Administrator-only record for the first protected NIU study-guide setup action.
- [x] Diagnose and repair the unreadable production response from the protected NIU starter-study-guide action, then verify a real private draft attachment and audit record.
- [x] Replace the production-incompatible protected Content Library file path with private Supabase object storage and scoped access controls without exposing learner materials publicly.
- [x] Add automatic NIU audit capture for protected content-library metadata and lesson-attachment changes made through the production-safe direct workflow.
- [x] Repair Vercel’s production TypeScript compilation of NIU server source so the private-storage release can deploy successfully.
- [x] Repair the reported `record "new" has no field "id"` Content Library audit-trigger error and verify the original private draft study guide is attached.
- [x] Remove public NIU programme discovery’s dependency on the unavailable Vercel server endpoint while preserving published-only visibility.
- [x] Complete server-validated readiness and controlled publication of the first authorised NIU certificate programme bundle after required content verification.
- [x] Repair the missing `niu_is_active_super_admin` function reference in the controlled first-certificate approval workflow and reverify the owner-authorised release action.
- [x] Repair the controlled first-certificate approval transition so it uses the live permitted `course_status` values and reverify the owner-authorised release action.
- [x] Align NIU programme-bundle readiness and publication functions with the live permitted status model without reducing role or material prerequisites.
- [x] Repair the published NIU programme-detail route so the successfully released first certificate programme is discoverable from its public listing.
- [x] Repair anonymous published programme-course relationship access so programme detail works without exposing staff authorization helpers or protected materials.
- [x] Correct remaining draft-only language in the authorised first certificate bundle’s published course and module descriptions.
- [ ] Repair NIU student enrolment so it writes the live `enrollment_status` enum safely, then verify real student enrolment and protected material access.
- [x] Replace popup-dependent protected library-resource opening with a direct authenticated signed-link navigation and explicit retrieval feedback for mobile learners.
- [ ] Repair the malformed punctuation encoding displayed in the published protected Digital Foundations study guide, then revalidate enrolled learner retrieval.

- [x] Rebuild the fragmented academic authoring entry point as one unified administrator Course Studio workspace.
- [x] Keep programme information, curriculum tree, modules, lessons, protected learning content, assessments, grading, completion rules, certificate settings, preview, validation, review, and publication inside Course Studio without redirect dead ends.
- [x] Add a responsive three-pane Course Studio layout with curriculum tree, main editor, and progress/checklist panel, including mobile-safe navigation.
- [x] Preserve existing NIU certificate-only scope, founder strings, private storage, role authorization, audit capture, versioning, and controlled publication safeguards in Course Studio.
- [x] Add focused Course Studio regression tests for workspace routing, authorization boundaries, curriculum relationships, critical validation blockers, and non-duplication of existing records.
- [x] Validate Course Studio with the full release gates, responsive screenshots, documentation, checkpoint, and repository push.

- [x] Change automatic programme-completion handling to create or refresh a server-calculated eligible candidate instead of issuing a certificate without administrator approval.
- [x] Add administrator-controlled certificate approval and issuance with duplicate prevention, audit attribution, exact founder strings, and certificate-only wording.
- [x] Add learner certificate, transcript, and supporting-document retrieval with protected access and explicit legal/recognition disclaimers.
- [x] Add lawful recommendation-letter workflow that is administrator-authored and clearly labelled as an NIU institutional letter, not an employment, licensing, accreditation, or universal-recognition guarantee.
- [x] Add regression tests and run full release validation for certificate eligibility, issuance control, privacy, duplicate prevention, and unsupported-claims safeguards.
- [ ] Update release notes, save a checkpoint, push the certificate-system release, and complete authorized production validation.

- [x] Safely archive or unpublish the unfinished first course and its public programme listing for a fresh start, preserving existing records, audit history, learner records, and reversible administrator control.
- [x] Verify the public catalogue no longer exposes the unfinished course after the fresh-start archive state is deployed.

- [x] Add accessible WhatsApp, email, and Facebook contact controls using the owner-provided contact details.
- [x] Verify the contact controls on desktop and mobile, run tests and build gates, document the change, checkpoint, and push the release.

- [x] Continue remaining safe NIU hardening work without requiring the owner to type technical details on a phone; document any checks that still require a real inbox or authenticated owner session.

- [ ] Capture inspectable evidence of one real self-service student email-link flow on the live deployment, such as a screenshot or shared browser-session view showing the student portal after the link is opened.
- [ ] Verify inspectably that the registered account lands only on student-authorized routes and cannot access staff or administrator workspaces after self-registration.
- [ ] Document concrete observable registration evidence in the release notes or tracker entry instead of relying only on a generic completion confirmation.

- [x] Add governed Question Bank management with private drafts, protected authoring, question editing, answer/correct-answer controls, difficulty/topic/objective/points metadata, approval status, saved-question attachment, and approved-assessment eligibility without seeding or changing curriculum records.
- [x] Validate Question Bank authorization, audit preservation, empty states, responsive UI, tests, build, and dependency gates; document, checkpoint, and push the release.

- [x] Repair the Question Bank difficulty constraint mismatch so inline create/edit uses live permitted values, without changing existing question records or governed approval behavior.
- [x] Validate the difficulty repair with focused tests, type-check, build, audit, responsive UI, documentation, checkpoint, and repository synchronization.

- [x] Harden future academic workflow governance across question banks, questions, assessments, courses, modules, lessons, learning resources, and certificate templates: draft-first statuses, manual review/approval, authorised publication gates, validation messaging, duplicate prevention, and audit preservation without altering existing content or records.
- [x] Validate assessment metadata, answer keys, points, passing scores, time limits, attempt limits, completion rules, and Course Studio propagation with tests, builds, responsive checks, documentation, checkpoint, and repository synchronization.

- [x] Build an admin-only Curriculum Import workflow inside the guided academic package flow: approved-document upload, structural analysis, draft-only generation, exact ordering and relationships, supported difficulty validation, missing-information markers, protected materials, activities, knowledge checks, assessments, question banks, final examination, completion rules, and certificate settings.
- [x] Add import progress, validation errors, review/correction/regeneration controls, duplicate protection, private learner access safeguards, existing publication-gate handoff, tests, responsive verification, documentation, checkpoint, and repository synchronization without modifying existing records or creating demo content.

- [x] Repair-only portion of the student enrollment workflow: `niu_enroll_in_course` now casts `active` and `completed` explicitly to the live `public.enrollment_status` enum, preserves prerequisite and published-course checks, and remains authenticated-only. Real student enrollment and protected-material retrieval evidence remain pending under the existing item above.

- [x] Prepare a complete phone-friendly guide for uploading one entire NIU course from department/programme setup through student enrollment, learning, assessment, completion, and certificate eligibility without bypassing governance.

- [x] Build a governed NIU AI Academic Builder for future certificate programmes: administrator topic/settings, staged planning and research, explicit-source content generation, draft-only real-record packaging, protected materials and visuals, assessment blueprint, quality validation, review/edit/regeneration, and manual approval/publication handoff.
- [x] Add AI Builder provenance, permissions, no-invention safeguards, supported difficulty validation, privacy controls, audit history, tests, responsive UX, release documentation, checkpoint, and repository synchronization without modifying existing records or creating demo data.

- [x] Add governed AI Builder research-review submission with HTTPS source provenance, minimum review notes, database-enforced transition, and admin UI controls.
- [x] Implement the AI Builder draft-generation handoff into private Curriculum Import artifacts without creating or publishing academic records automatically.
- [x] Build explicit-source deep research, visual-content planning, and assessment blueprint engines with provenance and missing-information boundaries.
- [x] Add administrator edit, regenerate, validation, review, approval, and publication handoff controls for AI-generated sections.
- [ ] Complete AI Builder full-suite validation, documentation, checkpoint, repository synchronization, and real-user evidence where required.

## AI Builder work history
- 2026-08-27: Planning stage and governed job lifecycle are functional; research-review submission now requires HTTPS source provenance and review notes. Draft-generation and deep-generation stages remain intentionally pending.
- 2026-08-28: Deep research mode now requires three distinct HTTPS evidence excerpts; private blueprint edits and post-plan Curriculum Import handoff remain review-only and draft-first. Repaired the handoff status update for both generation-review and ready-for-review jobs; no duplicate academic records are created by this fix.

## AI Builder correction requirements
- [x] Extend AI Builder beyond planning into a complete governed draft-package generation action for Digital Marketing and future certificate topics.
- [x] Generate linked private draft programme, courses, versions, modules, lessons, objectives, materials metadata, activities, question banks/questions, assessments, answer-key metadata, references, accessibility metadata, and certificate configuration using existing NIU schemas.
- [x] Add complete-package AI editing while keeping every edit private and draft-only.
- [x] Add comprehensive quality-gate results, read-only learner preview without answer keys or admin controls, final package review, and explicit human publication confirmation.
- [ ] Test the full Digital Marketing workflow with real database relationships only in an isolated draft job and without publishing or modifying existing academic records.

## AI visual engine and multi-provider correction requirements
- [x] Add server-only multi-provider AI orchestration with configurable OpenAI and Gemini model settings, without exposing provider keys or hardcoding stale model names.
- [x] Add evidence-bound visual analysis and structured visual specifications that decide when a lesson needs a diagram, flowchart, illustration, process map, or other learning-support visual.
- [x] Add protected visual generation, lesson placement, captions, alt text, detailed accessibility descriptions, provenance, versioning, review status, and no decorative-only generation. Cost controls and retry handling remain separately tracked.
- [x] Add lesson study-material and video visual-plan metadata plus assessment-visual metadata, keeping answer keys private and review-only.
- [x] Add administrator visual inspect/edit/regenerate/replace/remove controls and publication blocking for missing or unreviewed required visuals.
- [ ] Add long-running orchestration stages, continuation-safe retries, provider error handling, rate/cost controls, and auditable status transitions without automatic approval or publication.
- [ ] Validate the multi-provider visual workflow, secrets boundary, migrations, tests, mobile UI, build, deployment, and documentation without modifying existing academic records or creating demo data.

- [x] Apply additive protected AI visual asset schema with versioning, RLS, audit triggers, draft-first review status, and learner enrollment-gated reads.
- [x] Add server-only Gemini-backed evidence-bound visual specifications with explicit learning purpose, accuracy requirements, alt text, and accessibility requirements.
- [x] Add administrator-triggered original visual generation using the existing protected image service, private object storage, exact lesson/module links, provenance metadata, version records, and duplicate protection; generated visuals remain draft-only.
- [x] Extend the AI draft-package RPC to return exact lesson/module/course identifiers for safe visual placement without title-based guessing.
- [x] Add phone-friendly AI Builder controls for visual analysis and linked visual draft generation with clear review-only messaging.
- [x] Add regression assertions and run focused tests, TypeScript validation, and production build for the visual engine release.

## AI visual engine work history
- 2026-08-28: Applied the protected versioned visual-asset schema to the Online University Supabase project. Added evidence-bound Gemini visual specifications and server-side draft visual generation with private storage, accessibility metadata, provenance, exact lesson links, RLS, audit capture, and duplicate protection. No existing academic records were modified and no visual was approved or published.

## AI visual engine remaining validation
- [x] Add administrator inspect/edit/regenerate/replace/remove controls for persisted visual versions and publication blocking for required unreviewed visuals.
- [ ] Add continuation-safe long-running visual jobs, retry/cost controls, and provider fallback telemetry without automatic approval or publication.
- [ ] Complete isolated real Digital Marketing visual generation and authenticated owner-session validation without modifying existing records.
- [ ] Complete final release documentation, full-suite validation, checkpoint, repository synchronization, and live-user evidence for the visual engine.
- [x] Add bounded visual-generation attempts and persisted provider-error telemetry without exposing provider keys or approving content automatically.
- [x] Add a bounded twelve-visual batch guard and initial-attempt telemetry to prevent runaway generation actions.
- [x] Add auditable visual batch status, cursor progress, and a bounded per-action limit for safe continuation between administrator actions.

## Urgent AI Builder API connection repair
- [x] Trace the Generate Complete Programme Plan route from browser request through tRPC/server and identify the exact failing backend response.
- [x] Verify server-side OpenAI/Gemini configuration and deployed Vercel runtime evidence without exposing secrets; production project logs remain inaccessible in the current Vercel account scope.
- [x] Make successful and error API responses JSON-safe and prevent raw non-JSON parse errors from reaching administrators.
- [x] Independently test the configured AI provider path with the requested Digital Marketing planning payload; do not use mocks or fake responses.
- [x] Validate the production Vercel Digital Marketing flow through saved blueprint and research-review availability, or document the exact external blocker if production credentials/session are unavailable. The exact blocker is documented; authenticated success remains open.
- [ ] Complete the urgent AI Builder API repair without requiring computer use: configured-provider fallback, JSON-safe backend/client errors, and production-safe Digital Marketing validation.
- [ ] Verify the new production deployment through the accessible Vercel URL; do not claim the administrator-only blueprint save/research-review step without an authenticated owner session.
- [x] Document the reproducible production blocker: nova-me-six currently serves an old Vercel function that returns plain-text FUNCTION_INVOCATION_FAILED, while the accessible Vercel project is linked to a different ONLINE-UNIVERSITY repository; administrator production validation remains open.
- [x] Re-probe and validate the AI Builder production flow specifically on novainternationaluniversity.vercel.app, the user-confirmed live domain. The domain is reachable but still serves the stale FUNCTION_INVOCATION_FAILED deployment.
- [ ] Re-run the production endpoint and authenticated Digital Marketing blueprint/research-review validation after the user reports the Vercel linkage is complete.
- [ ] Revalidate novainternationaluniversity.vercel.app after the user saved OPENAI_API_KEY and GEMINI_API_KEY in the owning Vercel project, then run the production Digital Marketing flow if the function is live.
- [ ] Recheck novainternationaluniversity.vercel.app after the reported redeploy and verify the repaired JSON contract before attempting the live Digital Marketing workflow.
- [ ] Continue production verification using Android-compatible public checks only; do not require computer takeover or API-key sharing.
- [ ] Recheck the production endpoint after the latest reported deployment action and verify whether the repaired JSON-safe AI Builder backend is now live.
- [ ] Continue the autonomous production-repair pass and verify the actual live domain without computer takeover or API-key requests.
- [x] Investigate the confirmed Ready NOVA-ME production deployment’s remaining Vercel function failure on novainternationaluniversity.vercel.app and fix the runtime entrypoint/configuration if required. Removed unresolved server/storage and @shared runtime aliases, added guarded dynamic bootstrap import, and passed a fresh Vercel-style source check.
- [x] Fix the confirmed Vercel TypeScript errors in server/app.ts and server/routers/aiBuilder.ts so the deployed AI Builder function can initialize successfully.
- [ ] Verify the Vercel deployment built from commit 85ce2f2 is serving novainternationaluniversity.vercel.app and run the live Digital Marketing AI Builder checks.
- [x] Add and deploy a dependency-free `/api/healthz` function to distinguish Vercel platform routing from the main Express application bootstrap failure.
- [x] Replace unsupported `jsonb_object_length` in the readiness gate with a PostgreSQL-compatible non-empty JSON-object check, then revalidate the live RPC.
- [x] Repair the production programme-bundle readiness function to use the existing `public.lesson_content_items` relation, preserving governed checks and existing records.
- [x] Align every future lesson creation path with the live `lessons_kind_check` values, preserve material attachments/accessibility fields, and add exact regression coverage.
- [x] Build the preferred unified nine-step mobile Programme Builder with sequential unlocks, editable completed steps, inline course/module/lesson/content/assessment authoring, autosave, ordering, review, and governed publication handoff.
- [x] Scope certificate-programme readiness only to records explicitly attached through the selected programme package, with dynamic requirements and no hardcoded global counts.
- [x] Restore the unified Programme Builder’s live readiness RPC, selected-package explanation, and publication-lock behavior after reconciling the concurrent NOVA-ME route merge; full tests, TypeScript, and production build pass.
- [x] Consolidate the preferred administrator academic workspace at `/admin/academic-production-studio` while preserving compatibility aliases and governed sequential navigation.
- [x] Repair the Vercel API response boundary so native Vercel responses always receive JSON without Express-only method chaining.
- [ ] Audit and connect the remaining academic production paths against real Supabase IDs, RLS, approval, audit, private storage, enrollment, certificate, transcript, and verification workflows without deleting records.
- [ ] Complete the remaining security, accessibility, mobile, SEO, performance, deployment, and live-endpoint validation items from the master restructure requirements.
