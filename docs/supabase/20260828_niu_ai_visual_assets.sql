-- Governed AI-generated educational visuals use NIU's existing protected content library.
-- This migration is additive and does not reclassify or modify existing content.

alter table public.content_library_items
  add column if not exists visual_metadata jsonb;
alter table public.content_library_items
  add column if not exists is_generated_visual boolean not null default false;

create table if not exists public.ai_visual_asset_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_library_items(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  module_id uuid not null references public.course_modules(id) on delete cascade,
  programme_id uuid references public.certificate_programs(id) on delete set null,
  title text not null check (char_length(trim(title)) between 3 and 180),
  caption text not null check (char_length(trim(caption)) between 3 and 1000),
  alt_text text not null check (char_length(trim(alt_text)) between 3 and 1000),
  accessibility_description text not null check (char_length(trim(accessibility_description)) between 3 and 4000),
  educational_purpose text not null check (char_length(trim(educational_purpose)) between 3 and 2000),
  generation_model text not null check (char_length(trim(generation_model)) between 1 and 180),
  generation_prompt text not null check (char_length(trim(generation_prompt)) between 3 and 12000),
  generated_at timestamptz not null default now(),
  version integer not null check (version > 0),
  change_summary text not null default 'Initial draft visual',
  review_status text not null default 'draft' check (review_status in ('draft', 'review', 'approved', 'published', 'archived')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  generation_attempts integer not null default 0 check (generation_attempts >= 0 and generation_attempts <= 3),
  last_generation_error text,
  unique (content_item_id, version)
);

create index if not exists niu_idx_ai_visual_versions_lesson on public.ai_visual_asset_versions(lesson_id, version desc);
create index if not exists niu_idx_ai_visual_versions_content on public.ai_visual_asset_versions(content_item_id, review_status);

alter table public.ai_visual_asset_versions enable row level security;
drop policy if exists ai_visual_versions_staff_manage on public.ai_visual_asset_versions;
create policy ai_visual_versions_staff_manage on public.ai_visual_asset_versions for all to authenticated
using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
drop policy if exists ai_visual_versions_enrolled_read on public.ai_visual_asset_versions;
create policy ai_visual_versions_enrolled_read on public.ai_visual_asset_versions for select to authenticated using (
  public.niu_is_academic_staff() or exists (
    select 1
    from public.course_modules cm
    join public.enrollments e on e.course_id = cm.course_id
    where cm.id = ai_visual_asset_versions.module_id
      and e.user_id = auth.uid()
      and e.status in ('active', 'completed')
  )
);

drop trigger if exists niu_validate_ai_visual_version_status on public.ai_visual_asset_versions;
create trigger niu_validate_ai_visual_version_status
before insert or update on public.ai_visual_asset_versions
for each row execute function public.niu_validate_future_governed_status();

drop trigger if exists niu_audit_ai_visual_asset_versions on public.ai_visual_asset_versions;
create trigger niu_audit_ai_visual_asset_versions
after insert or update or delete on public.ai_visual_asset_versions
for each row execute function public.niu_capture_audit_event();

comment on table public.ai_visual_asset_versions is 'Protected, versioned, draft-first AI educational visuals. Published versions are immutable and learner access remains enrollment-gated.';
