-- Additive, certificate-only curriculum metadata for unlimited ordered course modules.
alter table public.course_modules add column if not exists learning_level text not null default 'foundation' check (learning_level in ('foundation', 'developing', 'applied', 'advanced', 'capstone'));
alter table public.course_modules add column if not exists learning_objectives jsonb not null default '[]'::jsonb;
alter table public.course_modules add column if not exists estimated_minutes integer not null default 0 check (estimated_minutes >= 0);
alter table public.course_modules add column if not exists support_guidance text;
