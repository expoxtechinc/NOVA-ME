-- NIU: fix lesson/content RLS recursion without deleting academic data.
-- The 20260910 policies formed a cycle:
-- lesson_content_items -> content_library_items -> lesson_content_items.
-- This migration removes only those two learner-read policies and moves the
-- relationship check into SECURITY DEFINER helpers that run outside table RLS.

create or replace function public.niu_can_access_published_lesson_content(
  target_lesson_id uuid,
  target_content_item_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.lessons l
    join public.course_modules cm on cm.id = l.module_id
    join public.program_courses pc on pc.course_id = cm.course_id
    join public.certificate_programs p on p.id = pc.program_id and p.status = 'published' and p.award_type = 'certificate'
    where l.id = target_lesson_id
      and (
        exists (
          select 1 from public.program_enrollments pe
          where pe.program_id = p.id
            and pe.user_id = auth.uid()
            and pe.status in ('active', 'completed')
        )
        or exists (
          select 1 from public.enrollments e
          where e.course_id = cm.course_id
            and e.user_id = auth.uid()
            and e.status in ('active', 'completed')
        )
      )
      and (
        target_content_item_id is null
        or exists (
          select 1
          from public.lesson_content_items lci
          join public.content_library_items cli on cli.id = lci.content_item_id
          where lci.lesson_id = l.id
            and lci.content_item_id = target_content_item_id
            and coalesce(cli.status, 'draft') in ('approved', 'published')
        )
      )
  );
$$;

create or replace function public.niu_can_access_published_content_item(target_content_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.lesson_content_items lci
    where lci.content_item_id = target_content_item_id
      and public.niu_can_access_published_lesson_content(lci.lesson_id, target_content_item_id)
  );
$$;

revoke all on function public.niu_can_access_published_lesson_content(uuid, uuid) from public, anon;
revoke all on function public.niu_can_access_published_content_item(uuid) from public, anon;
grant execute on function public.niu_can_access_published_lesson_content(uuid, uuid) to authenticated;
grant execute on function public.niu_can_access_published_content_item(uuid) to authenticated;

-- Remove only the policies that mutually queried the other relation. Staff
-- management policies remain unchanged and RLS remains enabled.
drop policy if exists lesson_content_enrolled_read on public.lesson_content_items;
drop policy if exists content_library_enrolled_read on public.content_library_items;

create policy lesson_content_enrolled_read on public.lesson_content_items
for select to authenticated
using (
  public.niu_is_academic_staff()
  or public.niu_can_access_published_lesson_content(lesson_id, content_item_id)
);

create policy content_library_enrolled_read on public.content_library_items
for select to authenticated
using (
  public.niu_is_academic_staff()
  or (
    coalesce(status, 'draft') in ('approved', 'published')
    and public.niu_can_access_published_content_item(id)
  )
);

-- Foreign-key indexes keep the non-recursive authorization path bounded as
-- programme packages and enrolments grow.
create index if not exists niu_idx_lesson_content_items_lesson_id on public.lesson_content_items(lesson_id);
create index if not exists niu_idx_lesson_content_items_content_item_id on public.lesson_content_items(content_item_id);
create index if not exists niu_idx_program_courses_course_program on public.program_courses(course_id, program_id);
create index if not exists niu_idx_program_enrollments_program_user_status on public.program_enrollments(program_id, user_id, status);

comment on function public.niu_can_access_published_lesson_content(uuid, uuid) is
  'Non-recursive enrolled-programme authorization for published lesson content; SECURITY DEFINER with a controlled search_path.';
comment on function public.niu_can_access_published_content_item(uuid) is
  'Non-recursive enrolled-programme authorization for published content items; SECURITY DEFINER with a controlled search_path.';
