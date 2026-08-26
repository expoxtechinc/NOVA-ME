alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;

drop policy if exists course_modules_enrolled_or_staff on public.course_modules;
create policy course_modules_enrolled_or_staff on public.course_modules for select to authenticated using (
  public.niu_is_academic_staff() or exists (
    select 1 from public.enrollments e
    where e.course_id = course_modules.course_id and e.user_id = auth.uid() and e.status in ('active', 'completed')
  )
);
drop policy if exists course_modules_staff_manage on public.course_modules;
create policy course_modules_staff_manage on public.course_modules for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());

drop policy if exists lessons_enrolled_or_staff on public.lessons;
create policy lessons_enrolled_or_staff on public.lessons for select to authenticated using (
  public.niu_is_academic_staff() or exists (
    select 1 from public.course_modules m join public.enrollments e on e.course_id = m.course_id
    where m.id = lessons.module_id and e.user_id = auth.uid() and e.status in ('active', 'completed')
  )
);
drop policy if exists lessons_staff_manage on public.lessons;
create policy lessons_staff_manage on public.lessons for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
