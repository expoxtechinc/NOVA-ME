-- Additive AI Academic Builder job model.
-- This stores a governed planning/generation job only; it does not create
-- academic records or publish content.

create table if not exists public.ai_academic_builder_jobs (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (length(trim(topic)) >= 3),
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','planning','research_review','generation_review','validation_failed','ready_for_review','approved','published','failed')),
  blueprint jsonb not null default '{}'::jsonb,
  research_plan jsonb not null default '[]'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  generated_record_ids jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz
);

create index if not exists ai_academic_builder_jobs_created_by_idx on public.ai_academic_builder_jobs(created_by);
create index if not exists ai_academic_builder_jobs_status_idx on public.ai_academic_builder_jobs(status);

alter table public.ai_academic_builder_jobs enable row level security;

drop policy if exists ai_academic_builder_jobs_staff_read on public.ai_academic_builder_jobs;
create policy ai_academic_builder_jobs_staff_read on public.ai_academic_builder_jobs
  for select to authenticated using (public.niu_is_academic_staff());

drop policy if exists ai_academic_builder_jobs_staff_insert on public.ai_academic_builder_jobs;
create policy ai_academic_builder_jobs_staff_insert on public.ai_academic_builder_jobs
  for insert to authenticated
  with check (public.niu_is_academic_staff() and created_by = auth.uid() and status = 'draft');

drop policy if exists ai_academic_builder_jobs_staff_update on public.ai_academic_builder_jobs;
create policy ai_academic_builder_jobs_staff_update on public.ai_academic_builder_jobs
  for update to authenticated
  using (public.niu_is_academic_staff())
  with check (public.niu_is_academic_staff());

create or replace function public.niu_ai_builder_touch_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_academic_builder_jobs_updated_at on public.ai_academic_builder_jobs;
create trigger ai_academic_builder_jobs_updated_at
before update on public.ai_academic_builder_jobs
for each row execute function public.niu_ai_builder_touch_updated_at();

create or replace function public.niu_ai_builder_audit_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events(actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), lower(tg_op) || '_ai_academic_builder_job', 'ai_academic_builder_job', new.id,
    jsonb_build_object('status', new.status, 'topic', new.topic));
  return new;
end;
$$;

drop trigger if exists ai_academic_builder_jobs_audit on public.ai_academic_builder_jobs;
create trigger ai_academic_builder_jobs_audit
after insert or update on public.ai_academic_builder_jobs
for each row execute function public.niu_ai_builder_audit_event();
