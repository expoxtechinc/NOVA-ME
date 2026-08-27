-- Additive generation-plan fields for the AI Academic Builder.
-- These fields store reviewable plans only; they do not create or publish academic records.

alter table public.ai_academic_builder_jobs
  add column if not exists research_evidence jsonb not null default '[]'::jsonb,
  add column if not exists content_plan jsonb not null default '{}'::jsonb,
  add column if not exists visual_plan jsonb not null default '[]'::jsonb,
  add column if not exists assessment_blueprint jsonb not null default '{}'::jsonb,
  add column if not exists draft_artifact jsonb not null default '{}'::jsonb,
  add column if not exists generated_by uuid references public.profiles(id) on delete set null,
  add column if not exists generated_at timestamptz;

comment on column public.ai_academic_builder_jobs.research_evidence is 'Explicit administrator-supplied evidence extracts tied to reviewed HTTPS sources; never inferred silently.';
comment on column public.ai_academic_builder_jobs.content_plan is 'Reviewable draft content plan; no learner-facing academic record.';
comment on column public.ai_academic_builder_jobs.visual_plan is 'Reviewable visual/content-accessibility plan; generation remains a separate authorised action.';
comment on column public.ai_academic_builder_jobs.assessment_blueprint is 'Reviewable assessment blueprint mapped to learning objectives; questions remain governed drafts.';
comment on column public.ai_academic_builder_jobs.draft_artifact is 'Private Curriculum Import handoff metadata; publication is never automatic.';
