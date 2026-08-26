create or replace function public.niu_enroll_in_course(target_course_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare output_enrollment public.enrollments;
begin
  if auth.uid() is null then raise exception 'Authenticated learner required'; end if;
  if not exists (select 1 from public.courses where id = target_course_id and status = 'published') then raise exception 'Published course not found'; end if;
  if exists (
    select 1 from public.course_prerequisites cp
    where cp.course_id = target_course_id
      and not exists (select 1 from public.enrollments completed where completed.user_id = auth.uid() and completed.course_id = cp.prerequisite_course_id and completed.status = 'completed')
  ) then raise exception 'Course prerequisites have not been completed'; end if;
  insert into public.enrollments (user_id, course_id, status, progress_percent, enrolled_at)
  values (auth.uid(), target_course_id, 'active', 0, now())
  on conflict (user_id, course_id) do update set status = case when public.enrollments.status = 'completed' then 'completed' else 'active' end
  returning * into output_enrollment;
  return output_enrollment;
end;
$$;

grant execute on function public.niu_enroll_in_course(uuid) to authenticated;
