-- Additive course-authoring metadata for certificate-learning administration.
alter table public.courses add column if not exists learning_outcomes jsonb not null default '[]'::jsonb;
alter table public.courses add column if not exists entry_requirements jsonb not null default '[]'::jsonb;
alter table public.courses add column if not exists certificate_template_key text;
alter table public.courses add column if not exists visual_reference_url text check (visual_reference_url is null or visual_reference_url ~ '^https://');
alter table public.courses add column if not exists publication_notes text;
