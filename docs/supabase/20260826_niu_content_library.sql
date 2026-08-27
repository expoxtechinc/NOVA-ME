-- Reusable protected learning materials for certificate-only NIU courses.
create table if not exists public.content_library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 180),
  category text not null check (category in ('document', 'presentation', 'image', 'audio', 'video', 'research', 'study_guide', 'external_resource')),
  file_name text not null check (char_length(trim(file_name)) between 1 and 180),
  content_type text not null,
  storage_path text not null unique,
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_content_items (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  content_item_id uuid not null references public.content_library_items(id) on delete restrict,
  position integer not null default 0 check (position >= 0),
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (lesson_id, content_item_id)
);

create index if not exists niu_idx_content_library_created_by on public.content_library_items(created_by);
create index if not exists niu_idx_content_library_category on public.content_library_items(category);
create index if not exists niu_idx_lesson_content_item on public.lesson_content_items(content_item_id);

alter table public.content_library_items enable row level security;
alter table public.lesson_content_items enable row level security;

drop policy if exists content_library_staff_manage on public.content_library_items;
create policy content_library_staff_manage on public.content_library_items for all to authenticated
using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());

drop policy if exists content_library_enrolled_read on public.content_library_items;
create policy content_library_enrolled_read on public.content_library_items for select to authenticated using (
  public.niu_is_academic_staff() or exists (
    select 1
    from public.lesson_content_items lci
    join public.lessons l on l.id = lci.lesson_id
    join public.course_modules cm on cm.id = l.module_id
    join public.enrollments e on e.course_id = cm.course_id
    where lci.content_item_id = content_library_items.id
      and e.user_id = auth.uid()
      and e.status in ('active', 'completed')
  )
);

drop policy if exists lesson_content_staff_manage on public.lesson_content_items;
create policy lesson_content_staff_manage on public.lesson_content_items for all to authenticated
using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());

drop policy if exists lesson_content_enrolled_read on public.lesson_content_items;
create policy lesson_content_enrolled_read on public.lesson_content_items for select to authenticated using (
  public.niu_is_academic_staff() or exists (
    select 1
    from public.lessons l
    join public.course_modules cm on cm.id = l.module_id
    join public.enrollments e on e.course_id = cm.course_id
    where l.id = lesson_content_items.lesson_id
      and e.user_id = auth.uid()
      and e.status in ('active', 'completed')
  )
);
