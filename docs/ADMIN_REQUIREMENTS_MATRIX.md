# NIU Academic Administration Requirements Matrix

This matrix records the delivery status for the requested administration model. NIU remains a **certificate-only** platform: no workflow represents degree enrolment, accreditation, recognition, partnership, or faculty claims unless independently authorised and published.

| Requested administration capability | NIU delivery status | Protected implementation route |
|---|---|---|
| Super Administrator overview, metrics, activity, and alerts | Implemented with real Supabase counts, audit events, and record-derived alerts; no mock institutional data | `/admin` |
| Institution identity, branding, academic calendar, policies, notices, and core settings | Existing governed institutional settings and academic operations controls | `/institution-settings`, `/academic-tools`, `/operations` |
| Schools, departments, certificate programmes, and programme status | Existing structure plus controlled draft/approval/published stages | `/institutional-builder`, `/operations` |
| Course title, category, description, difficulty, duration, author, status, versions, outcomes, entry requirements, certificate template, visual reference, and publication notes | Implemented in protected course authoring and version workflow | `/authoring`, `/institutional-builder`, `/content-preview` |
| Modules, sequence, description, and publication stage | Implemented as protected course-module records | `/authoring`, `/institutional-builder` |
| Lessons, material type, description, objectives, estimated time, points, required setting, staged publication, captions, and transcripts | Implemented as protected lesson records with additive authoring metadata | `/institutional-builder` |
| Uploadable learning notes | Implemented: type/size constrained, session-validated, role-validated, private object storage, existing-lesson attachment | `/institutional-builder` |
| Reusable central content library | Implemented for governed documents, presentations, images, audio, video, research, study guides, and approved external resources, with reusable lesson attachment | `/content-library` |
| Enrolment-protected learner material access | Implemented with server-authorised signed delivery; no public object URL is used as a learning entitlement | `/learning/:courseId` |
| Video, reading, document, flashcard, quiz, assignment, and assessment activity types | Implemented in lesson/assessment model and server-validated progress record | `/institutional-builder`, `/assessment-builder`, `/learning/:courseId` |
| Question banks, quizzes, knowledge checks, module tests, final assessments, examinations, and assignments | Implemented with protected authoring, draft/publication controls, settings, and immutable submission/grade records | `/academic-tools`, `/assessment-builder` |
| Attempts, timing, pass score, randomisation, release, and submission configuration | Implemented in protected academic-tools configuration | `/academic-tools` |
| Assignment due dates and late-submission policy | Implemented as stored policy with accept/flag, accept/penalty, reject-after-grace, penalty, and grace controls | `/assignment-policies` |
| Points, gradebook, weighted grading, released grades, and completion defaults | Existing protected grade and academic-configuration workflows; server-side progress and certificate eligibility remain authoritative | `/grading`, `/academic-configuration` |
| Student, faculty, administrator, and Super Administrator identity controls | Implemented through allowlist admission, database roles, account status, RLS, and auditable protected workspaces | `/access-control` |
| Account status: active, suspended, inactive | Implemented; records are preserved while inactive/suspended accounts are blocked from protected workflow functions | `/access-control` |
| Certificates: eligibility, review, approval, issuance, active/revoked/superseded status, public verification, history, and protected download | Implemented with server-side functions, unique credential numbers, audit history, and privacy-aware verification | `/registrar`, `/credential-history`, `/verify` |
| Automatic certificate eligibility and issuance | Implemented from server-verifiable completed programme/course records and configured passing score; client watch time alone cannot issue a credential | Database trigger plus `/registrar` |
| Certificate correction/reissue | Implemented for registrar-authorised corrections with a required reason, replacement credential number, and retained superseded original | `/credential-reissue` |
| Founder signature in certificate presentation | Implemented with exact approved signer text: `akinssokpah` and `Akin S. Sokpah — President and Founder` | `/certificate/:credentialNumber` |
| Student transcript / academic record | Implemented as protected, printable certificate-learning record; it does not represent a degree transcript | `/transcript` |
| Student dashboard, learning progress, grades, certificates, and transcript retrieval | Existing role-aware protected learner routes | `/portal`, `/learning`, `/credentials`, `/transcript` |
| Faculty dashboard, authoring, assessment, grading, feedback, and release | Existing role-aware protected faculty and academic routes | `/faculty`, `/authoring`, `/assessment-builder`, `/grading` |
| Registrar dashboard, certificate candidate review, issuance, revocation, history, and reissue | Implemented through protected registrar workflows | `/registrar`, `/credential-history`, `/credential-reissue` |
| Communication: programme/course announcements and accountable individual notices | Implemented with authorised announcement and notification records | `/academic-tools`, `/communication` |
| Reports, live operational summary, CSV export, and print/PDF-ready presentation | Implemented from authorised real institutional records only | `/reports` |
| Audit history and recent activity | Implemented through audit events; Super Administrator dashboard displays the recent authorised activity feed | `/admin` |
| Global accessibility and browser resilience | Implemented through responsive routes, safe unauthenticated states, protected error recovery, OAuth callback recovery, and live session reloading | Public site and protected routes |
| Google primary access and email-link fallback | Google sign-in is verified for the NIU Super Administrator. The restricted email-link fallback remains available; its separate final email-delivery return test is retained in `todo.md`. | `/signin`, `/auth/callback` |

## Operating dependencies

Two end-to-end checks depend on a real authorised person and real institutional content rather than fabricated test data: uploading a genuine learning note to a real existing lesson, and completing a full approved-user email-link return. The protected implementation, automated regression tests, builds, and unauthorised-route checks are complete; these two live content/account exercises remain tracked rather than being falsely marked complete.

All privileged actions are authorised server-side or by Supabase row-level policies. Learner access is scoped to active enrolment, uploaded material is held privately rather than in database blobs, and certificate issuance is driven by validated institutional records.
