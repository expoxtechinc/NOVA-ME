# Nova International University — Record-Connection and Evidence Audit

**Prepared by Manus AI · 1 September 2026**

## Scope and safety boundary

This checkpoint audits the current `NOVA-ME` release after the production packaging repair. The audit is read-only with respect to protected academic data: no programme was published, no learner credential was issued, and no existing protected academic record was changed. The repository was checked at commit `028b9d66ca747c9cd5edb7756be37214ed1fe4cc` on `main` [1].

## Verified deployment boundary

The supplied live custom domain responds successfully from the repaired deployment. `GET /api/healthz` returned HTTP 200 with JSON and reported build SHA `028b9d66ca747c9cd5edb7756be37214ed1fe4cc`. The actual tRPC AI Builder mutation route is `aiBuilder.createPlan`: an unauthorised `GET` returned a JSON HTTP 405 (`METHOD_NOT_SUPPORTED`), while an unknown procedure returned a JSON HTTP 404 (`NOT_FOUND`). These checks confirm the repaired Vercel function boundary and JSON error contract; they do **not** constitute authenticated AI Builder execution evidence.

| Boundary check | Result | Evidence status |
|---|---:|---|
| `/api/healthz` | HTTP 200 JSON; current SHA reported | Verified |
| `aiBuilder.createPlan` with GET | HTTP 405 JSON | Verified |
| Unknown tRPC procedure | HTTP 404 JSON | Verified |
| Authenticated blueprint save | Not exercised | Requires authorised owner session |
| Research-review submission | Not exercised | Requires authorised owner session |
| Real provider-backed Digital Marketing draft job | Not exercised in production | Requires authorised owner session and configured runtime credentials |

## Local release gates

The locked dependency installation completed. TypeScript checking, production build, and the Vercel boundary verifier passed. The full Vitest run currently reports **115 passed and 2 failed tests across 42 files**. Both failures are environment prerequisites rather than demonstrated application regressions: `GEMINI_API_KEY` is absent from the local test environment, and the expected `VITE_SUPABASE_URL`/publishable-key configuration is absent. The repository’s current test count is newer than the earlier release note that reported 113 of 115 tests.

| Gate | Result | Notes |
|---|---:|---|
| `pnpm check` | Pass | No TypeScript errors |
| `pnpm build` | Pass | Production client/server/API build completed |
| `pnpm verify:vercel` | Pass | Vercel entrypoint boundary verified |
| `pnpm test -- --run` | Conditional | 115 passed; 2 environment-bound failures |
| `git status` | Clean at audit start | No source changes were present before this report |

## Record-connection assessment

The current implementation and regression coverage support a connected academic chain rather than browser-storage-only records. The studio and server workflows use database identifiers for programme, course, module, lesson, content, assessment, question, certificate, and related records. The repository contains focused tests for academic records, programme packages, course studio relationships, question banks, content-library attachment, learner progress, certificate eligibility, transcripts, credential verification, and governed publication [1].

The connection model is **implemented at the application and workflow level**, but a complete production evidence chain remains open. In particular, the repository ledger explicitly leaves real student enrolment/protected-material retrieval, real self-service email-link registration, inspectable student-only access, People Governance walkthrough, and authenticated AI Builder draft generation as evidence-gated items [2]. These are not safe to mark complete from unauthenticated public probes or from unit tests alone.

| Record/workflow area | Current conclusion | Evidence class |
|---|---|---|
| Academic Production Studio route and sequential workflow | Present in current release | Repository and local tests |
| Programme → course/module/lesson authoring context | Uses real IDs and governed studio workflows | Repository and focused tests |
| Structured lesson content | Implemented with structured editor and sanitisation | Repository documentation and code |
| Content library and lesson attachments | Protected workflow is implemented; private-storage path is present | Repository and authorization tests |
| Assessments, questions, grading, completion | Server-validated foundations and tests are present | Repository and focused tests |
| Certificate, transcript, credential verification | Governed workflows and privacy tests are present | Repository and focused tests |
| Student enrolment with protected retrieval | Enum repair is implemented, but real end-to-end evidence remains open | Ledger explicitly pending |
| Self-service student email-link return | Role-default and anti-self-elevation protections are implemented, but inspectable live evidence remains open | Ledger explicitly pending |
| People Governance with real authorised records | Controls exist, but owner-session walkthrough remains open | Ledger explicitly pending |
| AI Builder authenticated save/review/generation | Draft-first governed implementation exists, but production execution evidence remains open | Ledger explicitly pending |

## Evidence gaps that must remain open

The following items require an authenticated and authorised owner or a real inbox. They should not be simulated, inferred from HTTP boundary checks, or closed merely because an owner reports completing them from a separate device.

1. A real self-service student registration should be completed on the live deployment, followed by opening the email link and observing the student portal return.
2. The resulting account should be shown to have student-only access, with staff and administrator routes denied and no self-elevation path.
3. A Super Administrator People Governance walkthrough should be performed using an authorised test record without changing the owner account.
4. A Super Administrator should run an isolated draft-only AI Builder workflow, including blueprint save and research review, without publishing or modifying existing academic records.
5. A Super Administrator should complete one protected learning-note or library-resource upload, then a real enrolled learner should retrieve it through the protected signed-link path.
6. The known malformed punctuation encoding in the published protected study-guide path should be repaired and revalidated as part of the learner retrieval exercise.

## Safe next actions

The next work should be evidence collection and narrowly scoped repair only. No production publication or protected-record mutation is necessary for the public boundary checks already completed. When an authorised session becomes available, use isolated draft/test records, capture observable results, preserve audit history, and rerun the release gates. Keep the current certificate-only positioning and the explicit prohibition on unsupported accreditation, degree, or recognition claims [1] [3].

## References

[1]: https://github.com/expoxtechinc/NOVA-ME "NOVA-ME repository and current release source"

[2]: https://github.com/expoxtechinc/NOVA-ME/blob/main/todo.md "NOVA-ME task ledger and evidence-gated items"

[3]: https://novainternationaluniversity.vercel.app/ "Nova International University live public website"

[4]: https://novainternationaluniversity.vercel.app/api/healthz "Nova International University deployment health endpoint"
