# NIU AI Academic Builder

## Current governed scope

The AI Academic Builder is available to authorised NIU academic staff at `/ai-academic-builder` and from the guided programme-package workflow. It accepts a certificate-programme topic and reviewable planning settings, then creates one private, audited planning job. The planning response is a structured blueprint containing programme identity, ordered courses, ordered modules, lessons, learning objectives, activity and material needs, assessment ideas, a research plan, quality gates, and missing-information warnings.

The planning stage is intentionally not a publication or academic-record creation action. It does not create departments, certificate programmes, courses, modules, lessons, learning resources, question banks, questions, assessments, examinations, or certificate templates. It does not approve or publish anything. Administrators must review the blueprint and research requirements before a future governed draft-generation stage is allowed to create private academic drafts. The administrator can submit HTTPS source provenance and research notes to move a job from `research_review` to `generation_review`; this still creates no academic records and does not approve or publish content.

## Safety and governance

The server checks the signed-in Supabase session and the `profiles.role` value before creating or reading a planning job. Student accounts are rejected. The job table uses staff-only row-level security and an audit trigger. The job lifecycle is forward-only: `draft → planning → research_review → generation_review → ready_for_review → approved → published → archived`, with failure and validation branches. Approval and publication require administrator-level authorization, and a published job can only be archived.

The structured AI request uses only the topic and explicit administrator settings. The system prompt forbids invented references, research findings, accreditation, licensing, employment, recognition, or other unsupported claims. It returns a source-research plan and marks source-dependent work as required before writing. Difficulty is constrained to `introductory`, `intermediate`, or `advanced`. Missing information is returned explicitly instead of being filled with placeholder academic facts. Research-review submissions require at least one HTTPS source and notes of at least 20 characters; database triggers enforce that gate.

## Review procedure

After planning finishes, the administrator should inspect the saved job, review the programme and ordered curriculum, resolve every missing-information warning, obtain authoritative references, and confirm the quality gates. The administrator may submit the source provenance and research notes to enter `generation_review`. From that state, the administrator can paste an evidence excerpt tied to an HTTPS source and request reviewable content, visual-accessibility, and assessment blueprints. These outputs are evidence-bound planning artifacts, not final teaching claims, questions, or media. A separate handoff can create a private Markdown Curriculum Import artifact and set the AI job to `ready_for_review`; it does not create programme records or publish anything. The existing Curriculum Import workflow remains responsible for explicit correction, draft generation, approval, and publication. This boundary protects NIU’s certificate-only governance and prevents AI output from entering the learner-facing catalogue without human review.

## Validation evidence

The AI Academic Builder regression suite covers staff-only job creation, the additive migrations, audit/status guards, HTTPS source provenance, evidence-bound structured output, no-invention wording, supported difficulty values, private Curriculum Import handoff, saved-job review, guided-package routing, and the no-academic-records-created boundary. TypeScript checking, the focused regression suite, production build, and production dependency audit pass for the current release.
