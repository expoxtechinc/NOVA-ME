# NIU AI Visual Learning Engine

The AI Visual Learning Engine is an administrator-only extension of the governed AI Academic Builder. It evaluates lesson plans for a learning-support visual, records an evidence-bound specification, and can generate an original image only after the administrator explicitly requests it. The system does not generate decorative media, invent academic labels, approve records, or publish content.

## Governed workflow

An administrator first creates a private AI Builder plan and completes research review with HTTPS provenance and evidence notes. The visual analysis stage then produces one structured specification per submitted lesson. Each specification includes whether a visual is needed, visual type, concept, learning objective, required structures and labels, layout, orientation, educational purpose, accuracy requirements, alt text, accessibility requirements, and a draft review status.

After a private draft package has been materialized, the package RPC returns exact lesson, module, and course identifiers. The administrator may then request linked visual draft generation. The server uses the existing protected image service, stores the image in private object storage, registers it as an `image` content-library item with `status = draft` and `governed_workflow = true`, attaches it to the exact lesson, and creates a version row in `ai_visual_asset_versions` with provenance and accessibility metadata.

> Every generated visual remains a private draft. Academic staff must inspect accuracy, edit metadata where required, move it through review, and use NIU’s existing publication gate. Published and archived visual versions are immutable.

## Safety boundaries

The visual prompt requires learning purpose, evidence-bound structures, minimal legible text, and no decorative-only imagery. Missing information is represented with `Missing:` markers. Duplicate generation for the same AI job and lesson reuses the existing draft version rather than creating another asset. Row-level security permits staff management and limits learner reads to enrolled users; audit triggers record version changes.

## Administrator sequence

Use the AI Academic Builder from the administrator dashboard. Create the programme plan, attach authoritative HTTPS evidence, submit research review, generate the evidence-bound review plans, and select **Analyse purposeful lesson visuals**. Review the returned visual specifications and their alt text. Generate the private academic package, then select **Generate linked visual drafts**. Review each private image and its metadata in the governed content workflow before any approval or publication action.

## Validation completed

The additive Supabase migration was applied to the Online University project. The full automated validation suite completed with 36 test files and 87 tests passing. TypeScript validation and production build completed successfully. The build reports an existing chunk-size advisory for the large application bundle; this is non-blocking and does not change runtime correctness.

## Remaining work

Persisted visual inspect/edit/regenerate/replace/remove controls beyond metadata editing, long-running continuation-safe orchestration with cost telemetry, isolated real Digital Marketing generation, and authenticated owner-session evidence remain separate validation items. No existing academic records were modified by this release.
