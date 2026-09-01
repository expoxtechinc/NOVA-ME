# Nova International University — Unified Academic Production Studio Audit

**Prepared by Manus AI · 31 August 2026**

## Executive assessment

The supplied project is a substantial, functioning certificate-learning platform rather than an empty scaffold. The public site is live and presents NIU as a certificate-only digital learning institution with public programme discovery, sign-in, learner portal, and credential verification [1]. The repository already contains a governed Course Studio, AI academic builder, assessment builder, content library, grading, certificate, registrar, and publication workflows [2].

However, the supplied acceptance test is **not yet demonstrated as complete**. The current implementation has a unified-looking `CourseStudio` page, but it still exposes multiple authoring routes and sends administrators into separate tools for questions and some downstream workflows. The content editor remains textarea-based rather than a professional structured rich-text editor, and the required full end-to-end administrator journey has not been proven by the current automated or live checks.

> **Bottom line:** preserve the current database, governance, users, and security model; consolidate the administrative UI around one `/academic-production-studio` route; then harden the database function permissions and complete end-to-end verification before claiming production readiness.

## What was inspected

| Area | Evidence inspected | Result |
|---|---|---|
| Live public site | `https://novainternationaluniversity.vercel.app` | Loads successfully. Public navigation includes About, Certificate Programs, Admissions, Resources, credential verification, My NIU, and Sign in. |
| Source repository | `expoxtechinc/NOVA-ME`, branch `main` | Cloned successfully. React/Vite/TypeScript client with Express/tRPC/Supabase-oriented server code. |
| Product specification | Attached `pasted_content.txt` | Requires one continuous NIU Academic Production Studio, structured academic content, AI generation, assessments, preview, validation, governance, security, testing, and deployment. |
| Static checks | `pnpm check`, `pnpm build` | Both passed. |
| Automated tests | `pnpm test` | 113 passed, 2 failed, across 41 test files. |
| Live Supabase | Online University project `oevgnonkqpvfvjsmovpw` | Active and healthy. Schema contains the core governed academic entities and foreign-key relationships. |
| Supabase advisors | Security and performance lints | Security warnings require attention; performance reports unindexed foreign keys. |

## Current strengths

The codebase has meaningful foundations that should not be discarded. `CourseStudio.tsx` already loads real programme, course, module, lesson, assessment, and certificate-related records; stores real IDs; uses database RPCs for readiness and workflow transitions; and includes local draft persistence. The repository also contains tests for Course Studio, programme publication, AI academic building, content upload, assessment handling, question banks, certificate workflows, security rules, browser resilience, and deployment behavior [2].

The live public positioning is appropriately cautious. The homepage explicitly states that NIU currently offers certificate programmes only and does not represent degree enrollment, accreditation, or recognition unless independently authorized and published [1]. This language should be preserved during UI consolidation.

The database model also appears materially aligned with the required record chain. The live schema includes certificate programmes, courses, programme-course links, course modules, lessons, lesson content, assessments, question relationships, certificates, profiles, audit records, and governance-related records. The live project is reported as `ACTIVE_HEALTHY` by the Supabase project listing [3].

## Main gaps against the acceptance test

| Requirement | Current finding | Priority |
|---|---|---:|
| One continuous workspace | A `CourseStudio` exists, but `App.tsx` still exposes separate `/authoring`, `/programme-builder`, `/course-studio`, `/assessment-builder`, `/content-library`, `/academic-tools`, `/grading`, `/programme-publication`, and other authoring routes. The studio also links out to the separate Assessment Builder. | P0 |
| Exact progress model | Current steps are Programme information → Courses and modules → Lessons → Learning content → Assessments → Points and completion → Certificate design → Student preview → Validation and publish. The requested workflow additionally calls for explicit Programme → Courses → Modules → Lessons → Content → Assessments → Points → Certificate → Preview → Validate → Publish, with completed-step navigation and future-step locks. | P0 |
| No manual linking | The studio uses real IDs and programme-course links, which is good, but the UI still relies on selected IDs and separate tool routes. This needs a single workspace context provider and a single save/continue orchestration layer. | P0 |
| Professional editor | The current lesson note flow includes a `textarea` for note content. This does not meet the requested rich-text academic editor, structured sections, media insertion, callouts, tables, formatting, or safe structured storage. | P0 |
| Structured academic notes | The specification requires reorderable sections such as Introduction, Objectives, Prerequisites, Main Content, Examples, Activity, Self-Check, Glossary, and Further Reading. The current evidence shows plain note fields rather than a structured document model. | P0 |
| AI generation in the workspace | AI academic builder functionality exists server-side and in a separate page. The acceptance path requires “Generate complete notes with Gemini” from inside the continuous studio, with review-only draft output and alignment checks. | P1 |
| Assessments and questions | Assessment records and question-bank tests exist, but the studio explicitly links to the separate Assessment Builder. Question generation and attachment therefore remain disconnected from the requested primary workspace. | P0 |
| Points and completion | Course Studio includes completion-rule fields and readiness checks. The full grading model—lesson, activity, quiz, assignment, assessment, final examination, totals, required points, and passing percentage—needs one consolidated screen and end-to-end test. | P1 |
| Preview | A read-only preview route exists, but the supplied acceptance test requires previewing the entire package, including media, assessments, points, completion, and certificate, within the same workspace context. | P1 |
| Validation and publication | Database readiness RPCs and governed transitions exist. The final studio should surface every validation failure with a direct “Fix this” action and invoke the existing publication gate rather than setting status directly. | P0 |
| Draft persistence | Local browser autosave exists in `CourseStudio.tsx`. It is not sufficient by itself for restoring the complete server-backed package after browser closure; server draft snapshots or a durable draft session should be verified. | P1 |
| Mobile-first workflow | The public homepage is responsive-looking, and the code uses responsive Tailwind classes. The administrator workflow still needs a dedicated small-screen test, especially for the horizontal progress row and rich editor. | P1 |
| Security | Supabase reports public `anon` and signed-in `authenticated` execution access for multiple `SECURITY DEFINER` functions, including AI-builder audit/touch functions, supporting-document operations, certificate review, AI-builder validation, and credential verification [4]. These permissions must be reviewed and narrowed deliberately. | P0 |
| Performance | Supabase reports unindexed foreign keys, including fields on academic calendar events, AI builder jobs, visual asset versions, assessment attempts, assessment questions, assignment submissions, and certificate candidates [5]. | P2 |

## Automated check results

`pnpm check` passed with no TypeScript errors, and `pnpm build` passed. The test suite did not fully pass: **113 tests passed and 2 failed**. The failures are configuration-bound rather than evidence that the entire product is correct.

| Failing test | Observed issue | Required action |
|---|---|---|
| `server/aiProviderSecrets.test.ts` | `GEMINI_API_KEY must be configured server-side` because the test environment did not provide the expected server-side Gemini credential. | Configure the intended server-side provider secret in the deployment/test environment and rerun; never expose it in client code. |
| `server/supabase.config.test.ts` | The expected configured publishable key was undefined in the test environment. | Provide the correct Supabase public configuration to the test environment and rerun. |

The repository documentation itself states that two real-world checks remain dependent on an authorized person and genuine institutional content: uploading a real learning note to an existing lesson and completing the email-link return flow [6]. These should remain explicitly tracked until exercised against production-like data.

## Live database findings

The live Supabase schema is sufficiently developed to support a consolidation rather than a database reset. It includes the core academic and governance records, and the repository’s requirements matrix states that valid academic records, users, certificates, private storage, RLS, audit logging, and publication gates are intended to be preserved [2].

The most urgent live issue is the security-advisor warning class identifying `SECURITY DEFINER` functions callable by `anon` or `authenticated`. A public credential-verification function may be intentional if it returns only minimal public data, but administrative, audit, review, AI-validation, and supporting-document functions should not be broadly executable without explicit authorization checks. The remediation should be a reversible migration that revokes unnecessary grants and confirms that authorized server calls continue to work [4].

The performance warnings are lower urgency but should be addressed in a separate safe migration after confirming existing indexes and query plans. Do not combine broad index changes with workflow consolidation until the actual foreign-key columns and production query patterns are verified [5].

## Recommended implementation sequence

### 1. Establish the new primary route without deleting valid functionality

Create `/academic-production-studio` as the only administrator-facing entry point for programme production. Move the existing Course Studio state and data-loading logic behind a workspace shell with a persistent programme/course/module/lesson context. Redirect obsolete authoring entry points to the new route rather than deleting database records or useful internal server functions.

### 2. Replace scattered step logic with an explicit workflow state machine

Define the exact eleven-step progress row requested by the specification. Each step should have a required-data predicate, a completed state, an active state, and a locked state. “Save Draft,” “Save & Continue,” “Back,” and “Resume” should operate against the same workspace session and preserve the real Supabase IDs.

### 3. Consolidate downstream tools into panels

Embed course, module, lesson, content, assessment, question, points, certificate, preview, validation, and publication panels inside the workspace. Internal modules may remain reusable, but they should render as workspace panels or dialogs instead of sending administrators to disconnected routes.

### 4. Introduce a structured safe document model

Replace the note textarea with a structured JSON document schema rendered through a maintained editor. Store sanitized editor output, not executable arbitrary HTML. Model academic sections as reorderable blocks and expose the required callouts, definitions, examples, objectives, takeaways, glossary, and media/resource blocks. Add mobile toolbar behavior and keyboard accessibility before connecting AI output.

### 5. Connect AI generation to draft-only workspace actions

Expose Starter, Standard, Premium, and complete-programme generation inside the studio. Gemini credentials must remain server-side. Every generated object should be created as Draft, pass objective/content/activity/assessment alignment checks, and require human review before approval or publication.

### 6. Harden Supabase permissions before production claims

Review every flagged `SECURITY DEFINER` function. Keep public verification only if its output and inputs are intentionally public and privacy-minimized. Revoke public execution on administrative and mutation functions, confirm explicit role checks, test RLS, and capture audit events for review and publication transitions.

### 7. Complete the acceptance test with real integration coverage

Add an authenticated end-to-end test that creates or resumes a draft programme, creates linked records, generates draft content, edits structured notes, attaches private content, creates and generates questions, configures grading and completion, previews, validates, submits for review, approves, and publishes through the existing governance gate. Include mobile viewport coverage and safe error-message assertions.

### 8. Deploy only after the full check matrix is green

Rerun TypeScript, production build, unit tests, integration tests, security tests, governance tests, end-to-end tests, Supabase validation, and `git diff --check`. Then commit the implementation to `main`, deploy the production build, smoke-test the live route, and report remaining issues honestly.

## Recommended next action

The correct next development increment is **not** a cosmetic rewrite of one component. It is a controlled consolidation sprint: build the new workspace shell and explicit workflow state machine first, then migrate the existing academic panels into it, followed by the structured editor and security migration. The current repository is a suitable base, but the acceptance test should not be marked complete until the separate-route leakage, textarea editor, live permission warnings, and two failing environment-dependent tests are resolved or explicitly signed off.

## References

[1]: https://novainternationaluniversity.vercel.app/ "Nova International University live public website"
[2]: https://github.com/expoxtechinc/NOVA-ME "NOVA-ME GitHub repository"
[3]: https://supabase.com/ "Supabase project inspection for Online University, project ref oevgnonkqpvfvjsmovpw"
[4]: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable "Supabase database linter: public SECURITY DEFINER functions executable by anon"
[5]: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys "Supabase database linter: unindexed foreign keys"
[6]: https://github.com/expoxtechinc/NOVA-ME/blob/main/docs/ADMIN_REQUIREMENTS_MATRIX.md "NOVA-ME administrative requirements matrix"


## Implementation update — 31 August 2026

The rebuild is now implemented in the canonical `/admin/academic-production-studio` route. The administrator dashboard leads with this single academic-authoring entry point while public and learner routes remain unchanged. The studio now presents the eleven-step workflow: Programme, Courses, Modules, Lessons, Learning Content, Assessments, Points, Certificate, Preview, Validate, and Publish.

The former Markdown-only lesson-note field was replaced with `StructuredLessonEditor`, which provides academic sections, formatting controls, reorderable blocks, word count, estimated reading time, autosave status, and safe sanitization. A live Supabase migration named `niu_structured_lesson_notes` was applied successfully to permit the additive `structured_json` content format while retaining the existing `external`, `markdown`, `plain_text`, and `html` formats.

Assessment authoring is embedded in the studio. Staff can create private question banks and draft questions, while only approved reusable questions are offered for assessment attachment. The existing server-side AI orchestration is also available from the Programme step as a bounded, draft-only blueprint assistant. It requires staff authorization and explicitly states that no academic records, questions, materials, approval, or publication are created by planning alone.

The final Publish step is administrator-only and invokes the protected `niu_publish_programme_bundle` RPC only after the live readiness gate passes and the administrator confirms the action. No learner credential is issued automatically. The implementation was committed to `main` in commits `8e2461c` and corrective commit `dea438f`; both were pushed to `expoxtechinc/NOVA-ME`.

The local type check and production build pass. The final automated suite passes 113 of 115 tests across 39 of 41 test files. The remaining two failures are environment prerequisites rather than application regressions: the test environment does not expose `GEMINI_API_KEY`, and the Supabase configuration test does not receive the expected publishable-key endpoint configuration. The linked Vercel project received commit `dea438f` and created production deployment `dpl_S772v1yWweUoTnPrEii2fFSrAdvG`; at the time of inspection it remained queued, while the prior production deployment was healthy.

The main remaining operational follow-up is to confirm the queued Vercel deployment reaches `READY` and to provide the missing CI/runtime environment variables for the two environment-only tests. The repository also retains a Vite chunk-size warning for the main application bundle; this is non-blocking and suitable for a later code-splitting pass.


## SEO, discovery, and trust audit — 1 September 2026

The latest SEO specification was implemented in commit `942bbb91d189931c2d3c758a00d8aa4a7b9df119`. The repository now includes a valid XML sitemap with 18 public URLs, a tightened robots policy that excludes administrative, authenticated, learner-record, and internal API routes, the requested Google verification filename, route-aware canonical metadata, unique public titles and descriptions, Open Graph and Twitter tags, visible breadcrumbs, and conservative JSON-LD for EducationalOrganization, WebSite, WebPage, and BreadcrumbList. Two original public information pages were added: `/online-learning` and `/how-niu-certificates-are-verified`.

Local validation passed: TypeScript checking, production build, XML parsing, robots assertions, and verification-file content assertions. The production Vercel deployment for this commit reached `READY` as `dpl_7L5TTF4C5wiXnaugVvD7vQVqoyzE`, with aliases `nova-me-expoxtechincs-projects.vercel.app`, `nova-me-six.vercel.app`, and `nova-me-git-main-expoxtechincs-projects.vercel.app`.

The live crawl confirmed HTTP 200 responses for `/`, `/robots.txt`, `/sitemap.xml`, `/google719635f5627ba863.html`, `/about`, `/programs`, `/courses`, `/verify`, `/online-learning`, and `/how-niu-certificates-are-verified`. The sitemap is valid XML, contains 18 URLs, and the verification file returns the expected conventional body `google-site-verification: google719635f5627ba863.html`. The live response also confirmed HTTPS, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and the expected crawler policy.

### Production blocker

The live responses currently include `X-Robots-Tag: noindex` on the supplied `https://novainternationaluniversity.vercel.app/` URL and on the Vercel project aliases. The linked Vercel project reports `live: false` and lists only the `nova-me` Vercel aliases as project domains; the supplied `novainternationaluniversity.vercel.app` hostname is not listed in the linked project’s domain inventory. Vercel documents that deployment-only or non-production URLs receive automatic noindex behavior to prevent duplicate indexing. Consequently, the implementation is **not yet production SEO-ready**, even though the application-level SEO assets are present and validated.

The remaining deployment action is to assign an actual public production domain to the Vercel project, make that domain the canonical host, and then re-run the production crawl. The current sitemap and canonical metadata intentionally continue to use the supplied NIU hostname, but this must be confirmed as the authoritative production domain before Search Console or Bing submission. Search Console, Bing Webmaster Tools, Yandex, Core Web Vitals, and real mobile-device outcomes cannot be honestly marked verified from this environment without ownership access and an indexable production hostname.

### References

[1]: https://developers.google.com/search/docs/crawling-indexing/robots/intro "Google Search Central: Introduction to robots.txt"
[2]: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag "Google Search Central: Robots meta tag and X-Robots-Tag specifications"
[3]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google Search Central: Introduction to structured data markup"
[4]: https://schema.org/BreadcrumbList "Schema.org: BreadcrumbList"
[5]: https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines "Vercel: Why Preview Deployments are not indexed by search engines"
[6]: https://vercel.com/kb/guide/avoiding-duplicate-content-with-vercel-app-urls "Vercel: Avoiding duplicate content with vercel.app URLs"
