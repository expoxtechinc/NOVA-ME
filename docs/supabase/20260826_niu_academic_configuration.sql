alter table public.institution_settings add column if not exists certificate_templates jsonb not null default '[]'::jsonb;
alter table public.institution_settings add column if not exists grading_scales jsonb not null default '[]'::jsonb;
alter table public.institution_settings add column if not exists completion_rule_defaults jsonb not null default '{}'::jsonb;
alter table public.institution_settings add constraint institution_settings_certificate_only_scope check (award_scope = 'certificate_only') not valid;
