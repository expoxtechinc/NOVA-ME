-- Additive Curriculum Import jobs. This migration creates no import jobs and no academic records.
create table if not exists public.curriculum_imports (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null check (char_length(source_file_name) between 1 and 255),
  source_mime_type text not null check (char_length(source_mime_type) between 1 and 160),
  source_storage_path text not null unique,
  source_sha256 text,
  status text not null default 'uploaded' check (status in ('uploaded', 'analyzing', 'generated', 'validation_failed', 'review', 'approved', 'published', 'failed')),
  analysis jsonb not null default '{}'::jsonb,
  generated_record_ids jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  review_notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists curriculum_imports_created_by_idx on public.curriculum_imports(created_by, created_at desc);
create index if not exists curriculum_imports_status_idx on public.curriculum_imports(status, updated_at desc);

alter table public.curriculum_imports enable row level security;

drop policy if exists curriculum_imports_staff_read on public.curriculum_imports;
create policy curriculum_imports_staff_read on public.curriculum_imports for select to authenticated using (public.niu_is_academic_staff());

drop policy if exists curriculum_imports_staff_insert on public.curriculum_imports;
create policy curriculum_imports_staff_insert on public.curriculum_imports for insert to authenticated with check (public.niu_is_academic_staff() and created_by = auth.uid() and status = 'uploaded');

drop policy if exists curriculum_imports_staff_update on public.curriculum_imports;
create policy curriculum_imports_staff_update on public.curriculum_imports for update to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());

drop trigger if exists niu_audit_curriculum_imports on public.curriculum_imports;
create trigger niu_audit_curriculum_imports after insert or update or delete on public.curriculum_imports for each row execute function public.niu_capture_audit_event();

comment on table public.curriculum_imports is 'Private, audited, draft-only source and validation state for future curriculum imports; academic records are created only by an explicit authorised generation action.';
