-- Preserve the existing controlled enrollment checks while making every status
-- assignment explicitly compatible with the live enrollment_status enum.

create or replace function public.niu_enroll_in_course(target_course_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  output_enrollment public.enrollments;
begin
  if auth.uid() is null or not public.niu_account_is_active() then
    raise exception 'An active NIU account is required';
  end if;

  if not exists (select 1 from public.courses where id = target_course_id and status = 'published') then
    raise exception 'Published course not found';
  end if;

  if exists (
    select 1
    from public.course_prerequisites prerequisite
    where prerequisite.course_id = target_course_id
      and not exists (
        select 1 from public.enrollments completed
        where completed.user_id = auth.uid()
          and completed.course_id = prerequisite.prerequisite_course_id
          and completed.status = 'completed'::public.enrollment_status
      )
  ) then
    raise exception 'Course prerequisites have not been completed';
  end if;

  insert into public.enrollments (user_id, course_id, status, progress_percent, enrolled_at)
  values (auth.uid(), target_course_id, 'active'::public.enrollment_status, 0, now())
  on conflict (user_id, course_id) do update
  set status = case
    when public.enrollments.status = 'completed'::public.enrollment_status then 'completed'::public.enrollment_status
    else 'active'::public.enrollment_status
  end
  returning * into output_enrollment;

  return output_enrollment;
end;
$$;

revoke all on function public.niu_enroll_in_course(uuid) from public, anon;
grant execute on function public.niu_enroll_in_course(uuid) to authenticated;
