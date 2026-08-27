-- Account-state governance retains institutional records while disabling protected workflows.
alter table public.profiles add column if not exists account_status text not null default 'active' check (account_status in ('active', 'suspended', 'inactive'));
create index if not exists niu_idx_profiles_account_status on public.profiles(account_status);

create or replace function public.niu_account_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and account_status = 'active');
$$;

revoke all on function public.niu_account_is_active() from public, anon, authenticated;

create or replace function public.niu_is_academic_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.niu_account_is_active() and (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin', 'administrator', 'instructor'))
    or exists (select 1 from public.profile_role_assignments r where r.profile_id = auth.uid() and r.institutional_role in ('registrar', 'academic_director', 'content_manager', 'faculty_manager', 'examiner', 'student_support'))
  );
$$;

create or replace function public.niu_is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.niu_account_is_active() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin', 'administrator'));
$$;

create or replace function public.niu_enroll_in_course(target_course_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare output_enrollment public.enrollments;
begin
  if auth.uid() is null or not public.niu_account_is_active() then raise exception 'An active NIU account is required'; end if;
  if not exists (select 1 from public.courses where id = target_course_id and status = 'published') then raise exception 'Published course not found'; end if;
  if exists (select 1 from public.course_prerequisites cp where cp.course_id = target_course_id and not exists (select 1 from public.enrollments completed where completed.user_id = auth.uid() and completed.course_id = cp.prerequisite_course_id and completed.status = 'completed')) then raise exception 'Course prerequisites have not been completed'; end if;
  insert into public.enrollments (user_id, course_id, status, progress_percent, enrolled_at) values (auth.uid(), target_course_id, 'active', 0, now()) on conflict (user_id, course_id) do update set status = case when public.enrollments.status = 'completed' then 'completed' else 'active' end returning * into output_enrollment;
  return output_enrollment;
end;
$$;

create or replace function public.niu_record_learning_progress(target_lesson_id uuid, target_activity_kind text, reported_progress numeric, reported_position_seconds integer default null, reported_page integer default null)
returns public.learning_progress
language plpgsql
security definer
set search_path = public
as $$
declare progress_row public.learning_progress; valid_enrollment boolean;
begin
  if auth.uid() is null or not public.niu_account_is_active() then raise exception 'An active NIU account is required'; end if;
  select exists (select 1 from public.lessons l join public.course_modules m on m.id = l.module_id join public.enrollments e on e.course_id = m.course_id where l.id = target_lesson_id and e.user_id = auth.uid() and e.status in ('active', 'completed')) into valid_enrollment;
  if not valid_enrollment then raise exception 'Enrollment is required for this activity'; end if;
  if target_activity_kind not in ('lesson', 'video', 'document', 'flashcards', 'quiz', 'assignment', 'assessment') then raise exception 'Unsupported activity kind'; end if;
  insert into public.learning_progress (user_id, lesson_id, activity_kind, progress_percent, last_position_seconds, last_page, completed_at, verified_at, updated_at) values (auth.uid(), target_lesson_id, target_activity_kind, greatest(0, least(reported_progress, 100)), reported_position_seconds, reported_page, case when reported_progress >= 100 then now() else null end, now(), now()) on conflict (user_id, lesson_id, activity_kind) do update set progress_percent = greatest(public.learning_progress.progress_percent, excluded.progress_percent), last_position_seconds = greatest(coalesce(public.learning_progress.last_position_seconds, 0), coalesce(excluded.last_position_seconds, 0)), last_page = greatest(coalesce(public.learning_progress.last_page, 0), coalesce(excluded.last_page, 0)), completed_at = coalesce(public.learning_progress.completed_at, excluded.completed_at), verified_at = now(), updated_at = now() returning * into progress_row;
  return progress_row;
end;
$$;
