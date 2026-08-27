-- Public programme detail must not evaluate staff-only helper functions for anon.
-- Public rows remain limited to courses belonging to published certificate programmes.

drop policy if exists program_courses_public_or_staff on public.program_courses;

create policy program_courses_published_public_read
on public.program_courses
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.certificate_programs programme
    where programme.id = program_courses.program_id
      and programme.status = 'published'
  )
);
