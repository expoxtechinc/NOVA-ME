-- Learners may only read approved/published lesson content.
-- Academic staff retain full governed access.

drop policy if exists lesson_content_enrolled_read on public.lesson_content_items;
create policy lesson_content_enrolled_read on public.lesson_content_items
for select to authenticated
using (
  public.niu_is_academic_staff()
  or (
    exists (
      select 1
      from public.lessons l
      join public.course_modules cm on cm.id = l.module_id
      join public.enrollments e on e.course_id = cm.course_id
      where l.id = lesson_content_items.lesson_id
        and e.user_id = auth.uid()
        and e.status in ('active','completed')
    )
    and exists (
      select 1 from public.content_library_items cli
      where cli.id = lesson_content_items.content_item_id
        and cli.status in ('approved','published')
    )
  )
);

drop policy if exists content_library_enrolled_read on public.content_library_items;
create policy content_library_enrolled_read on public.content_library_items
for select to authenticated
using (
  public.niu_is_academic_staff()
  or (
    content_library_items.status in ('approved','published')
    and exists (
      select 1
      from public.lesson_content_items lci
      join public.lessons l on l.id = lci.lesson_id
      join public.course_modules cm on cm.id = l.module_id
      join public.enrollments e on e.course_id = cm.course_id
      where lci.content_item_id = content_library_items.id
        and e.user_id = auth.uid()
        and e.status in ('active','completed')
    )
  )
);
