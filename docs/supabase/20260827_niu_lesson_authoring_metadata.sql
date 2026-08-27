-- Additive content-authoring metadata for certificate-learning lessons.
alter table public.course_modules add column if not exists status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived'));
alter table public.lessons add column if not exists learning_objectives jsonb not null default '[]'::jsonb;
alter table public.lessons add column if not exists estimated_minutes integer not null default 0 check (estimated_minutes >= 0);
alter table public.lessons add column if not exists points numeric(7,2) not null default 0 check (points >= 0);
alter table public.lessons add column if not exists caption_text text;
alter table public.lessons add column if not exists transcript_text text;
alter table public.lessons add column if not exists status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived'));
create index if not exists niu_idx_course_modules_status on public.course_modules(status);
create index if not exists niu_idx_lessons_status on public.lessons(status);
