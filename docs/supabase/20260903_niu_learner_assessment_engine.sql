-- NIU learner assessment engine
-- Additive and backward-compatible: existing assessment_attempts rows remain intact.
-- Learner writes are routed through the two RPCs below; no academic data is seeded or rewritten.

alter table public.assessment_attempts
  add column if not exists assessment_id uuid,
  add column if not exists enrollment_id uuid,
  add column if not exists attempt_number integer,
  add column if not exists started_at timestamptz,
  add column if not exists percentage numeric(5,2),
  add column if not exists status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_attempts_assessment_id_fkey'
      and conrelid = 'public.assessment_attempts'::regclass
  ) then
    alter table public.assessment_attempts
      add constraint assessment_attempts_assessment_id_fkey
      foreign key (assessment_id) references public.assessments(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_attempts_enrollment_id_fkey'
      and conrelid = 'public.assessment_attempts'::regclass
  ) then
    alter table public.assessment_attempts
      add constraint assessment_attempts_enrollment_id_fkey
      foreign key (enrollment_id) references public.enrollments(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_attempts_attempt_number_positive'
      and conrelid = 'public.assessment_attempts'::regclass
  ) then
    alter table public.assessment_attempts
      add constraint assessment_attempts_attempt_number_positive
      check (attempt_number is null or attempt_number > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_attempts_percentage_range'
      and conrelid = 'public.assessment_attempts'::regclass
  ) then
    alter table public.assessment_attempts
      add constraint assessment_attempts_percentage_range
      check (percentage is null or (percentage >= 0 and percentage <= 100));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_attempts_status_allowed'
      and conrelid = 'public.assessment_attempts'::regclass
  ) then
    alter table public.assessment_attempts
      add constraint assessment_attempts_status_allowed
      check (status is null or status in ('in_progress', 'submitted', 'expired', 'abandoned'));
  end if;
end
$$;

-- Null legacy columns make these indexes safe for existing rows. The partial unique
-- index prevents duplicate numbered attempts without trying to backfill history.
create index if not exists assessment_attempts_user_assessment_status_idx
  on public.assessment_attempts(user_id, assessment_id, status);
create index if not exists assessment_attempts_enrollment_assessment_idx
  on public.assessment_attempts(enrollment_id, assessment_id);
create unique index if not exists assessment_attempts_assessment_user_attempt_unique
  on public.assessment_attempts(assessment_id, user_id, attempt_number)
  where assessment_id is not null and user_id is not null and attempt_number is not null;

-- Keep attempt history visible to its owner (and academic staff), while all writes
-- are performed by the SECURITY DEFINER RPCs below. Existing rows are not changed.
alter table public.assessment_attempts enable row level security;
drop policy if exists assessment_attempts_own_read on public.assessment_attempts;
create policy assessment_attempts_own_read
  on public.assessment_attempts for select to authenticated
  using (user_id = auth.uid() or public.niu_is_academic_staff());
drop policy if exists assessment_attempts_no_direct_insert on public.assessment_attempts;
create policy assessment_attempts_no_direct_insert
  on public.assessment_attempts for insert to authenticated
  with check (false);
drop policy if exists assessment_attempts_no_direct_update on public.assessment_attempts;
create policy assessment_attempts_no_direct_update
  on public.assessment_attempts for update to authenticated
  using (false) with check (false);
drop policy if exists assessment_attempts_no_direct_delete on public.assessment_attempts;
create policy assessment_attempts_no_direct_delete
  on public.assessment_attempts for delete to authenticated
  using (false);

revoke insert, update, delete on public.assessment_attempts from public, anon, authenticated;

drop function if exists public.niu_start_assessment(uuid, uuid);
create or replace function public.niu_start_assessment(
  target_assessment_id uuid,
  target_enrollment_id uuid
)
returns public.assessment_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target_assessment public.assessments;
  target_enrollment public.enrollments;
  existing_attempt public.assessment_attempts;
  output_attempt public.assessment_attempts;
  next_attempt_number integer;
  used_attempts integer;
begin
  if actor is null then
    raise exception 'Authenticated learner required';
  end if;
  if target_assessment_id is null or target_enrollment_id is null then
    raise exception 'Assessment and enrollment are required';
  end if;

  -- This transaction-scoped advisory lock serializes starts for the same learner,
  -- assessment, and enrollment, so concurrent requests cannot both pass the limit.
  perform pg_advisory_xact_lock(hashtextextended(
    actor::text || ':' || target_assessment_id::text || ':' || target_enrollment_id::text,
    0
  ));

  select * into target_assessment
  from public.assessments
  where id = target_assessment_id
    and status in ('approved', 'published');
  if not found then
    raise exception 'Assessment is not available for learner attempts';
  end if;

  select * into target_enrollment
  from public.enrollments
  where id = target_enrollment_id
    and user_id = actor
    and course_id = target_assessment.course_id
    and status = 'active'::public.enrollment_status
  for update;
  if not found then
    raise exception 'An active enrollment for this assessment is required';
  end if;

  -- Retrying a start request returns the learner's open attempt instead of
  -- consuming another attempt. Abandoned attempts are deliberately not open.
  select * into existing_attempt
  from public.assessment_attempts
  where user_id = actor
    and assessment_id = target_assessment_id
    and enrollment_id = target_enrollment_id
    and status = 'in_progress'
  order by started_at desc nulls last, id
  limit 1
  for update;
  if found then
    return existing_attempt;
  end if;

  select count(*)::integer, coalesce(max(attempt_number), 0) + 1
    into used_attempts, next_attempt_number
  from public.assessment_attempts
  where user_id = actor
    and assessment_id = target_assessment_id
    and coalesce(status, 'submitted') <> 'abandoned';

  if target_assessment.attempt_limit is not null
     and used_attempts >= target_assessment.attempt_limit then
    raise exception 'Assessment attempt limit reached';
  end if;

  insert into public.assessment_attempts (
    user_id, lesson_id, assessment_id, enrollment_id, attempt_number,
    started_at, status, answers
  )
  values (
    actor, null, target_assessment_id, target_enrollment_id, next_attempt_number,
    now(), 'in_progress', '{}'::jsonb
  )
  returning * into output_attempt;

  return output_attempt;
end;
$$;

revoke all on function public.niu_start_assessment(uuid, uuid) from public, anon;
grant execute on function public.niu_start_assessment(uuid, uuid) to authenticated;

drop function if exists public.niu_submit_assessment(uuid, jsonb);
create or replace function public.niu_submit_assessment(
  target_attempt_id uuid,
  target_answers jsonb
)
returns public.assessment_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target_attempt public.assessment_attempts;
  target_assessment public.assessments;
  target_enrollment public.enrollments;
  total_points numeric := 0;
  earned_points numeric := 0;
  question_count integer := 0;
  calculated_percentage numeric(5,2);
  output_attempt public.assessment_attempts;
begin
  if actor is null then
    raise exception 'Authenticated learner required';
  end if;
  if target_answers is null or jsonb_typeof(target_answers) <> 'object' then
    raise exception 'Assessment answers must be a JSON object';
  end if;

  select * into target_attempt
  from public.assessment_attempts
  where id = target_attempt_id and user_id = actor
  for update;
  if not found then
    raise exception 'Assessment attempt not found';
  end if;
  if target_attempt.status <> 'in_progress'
     or target_attempt.assessment_id is null
     or target_attempt.enrollment_id is null then
    raise exception 'Assessment attempt is not open for submission';
  end if;

  select * into target_assessment
  from public.assessments
  where id = target_attempt.assessment_id
    and status in ('approved', 'published');
  if not found then
    raise exception 'Assessment is not available for submission';
  end if;

  select * into target_enrollment
  from public.enrollments
  where id = target_attempt.enrollment_id
    and user_id = actor
    and course_id = target_assessment.course_id
    and status in ('active'::public.enrollment_status, 'completed'::public.enrollment_status);
  if not found then
    raise exception 'A valid enrollment is required to submit this attempt';
  end if;

  select
    coalesce(sum(coalesce(aq.points_override, q.points)), 0),
    coalesce(sum(
      case
        when (target_answers ? (q.id::text))
         and q.answer_key ->> 'correct_choice_id' = target_answers ->> (q.id::text)
        then coalesce(aq.points_override, q.points)
        else 0
      end
    ), 0),
    count(*)::integer
  into total_points, earned_points, question_count
  from public.assessment_questions aq
  join public.questions q on q.id = aq.question_id
  where aq.assessment_id = target_assessment.id;

  if question_count = 0 or total_points <= 0 then
    raise exception 'Assessment has no scorable questions';
  end if;

  calculated_percentage := round((earned_points / total_points) * 100, 2);

  update public.assessment_attempts
  set answers = target_answers,
      score = earned_points,
      percentage = calculated_percentage,
      passed = calculated_percentage >= target_assessment.passing_score,
      submitted_at = now(),
      status = 'submitted'
  where id = target_attempt.id
  returning * into output_attempt;

  return output_attempt;
end;
$$;

revoke all on function public.niu_submit_assessment(uuid, jsonb) from public, anon;
grant execute on function public.niu_submit_assessment(uuid, jsonb) to authenticated;


drop function if exists public.niu_get_assessment_for_learner(uuid, uuid);
create or replace function public.niu_get_assessment_for_learner(
  target_assessment_id uuid,
  target_enrollment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target_assessment public.assessments;
  target_enrollment public.enrollments;
  assessment_payload jsonb;
begin
  if actor is null then raise exception 'Authenticated learner required'; end if;
  select * into target_assessment from public.assessments where id=target_assessment_id and status in ('approved','published');
  if not found then raise exception 'Assessment is not available for learner access'; end if;
  select * into target_enrollment from public.enrollments where id=target_enrollment_id and user_id=actor and course_id=target_assessment.course_id and status in ('active'::public.enrollment_status,'completed'::public.enrollment_status);
  if not found then raise exception 'A valid enrollment for this assessment is required'; end if;
  select jsonb_build_object(
    'id', target_assessment.id,
    'title', target_assessment.title,
    'assessment_type', target_assessment.assessment_type,
    'passing_score', target_assessment.passing_score,
    'attempt_limit', target_assessment.attempt_limit,
    'time_limit_minutes', target_assessment.time_limit_minutes,
    'required_completion_rules', target_assessment.required_completion_rules,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'question_type',q.question_type,'choices',q.choices,'points',coalesce(aq.points_override,q.points)) order by aq.position) from public.assessment_questions aq join public.questions q on q.id=aq.question_id where aq.assessment_id=target_assessment.id and q.approval_status in ('approved','published')), '[]'::jsonb)
  ) into assessment_payload;
  return assessment_payload;
end;
$$;
revoke all on function public.niu_get_assessment_for_learner(uuid,uuid) from public,anon;
grant execute on function public.niu_get_assessment_for_learner(uuid,uuid) to authenticated;


drop function if exists public.niu_list_assessments_for_learner(uuid, uuid);
create or replace function public.niu_list_assessments_for_learner(
  target_course_id uuid,
  target_enrollment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare actor uuid := auth.uid(); result jsonb;
begin
  if actor is null then raise exception 'Authenticated learner required'; end if;
  if not exists (select 1 from public.enrollments e where e.id=target_enrollment_id and e.user_id=actor and e.course_id=target_course_id and e.status in ('active'::public.enrollment_status,'completed'::public.enrollment_status)) then raise exception 'A valid enrollment for this course is required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'assessment_type',a.assessment_type,'passing_score',a.passing_score,'attempt_limit',a.attempt_limit,'time_limit_minutes',a.time_limit_minutes) order by a.created_at), '[]'::jsonb) into result from public.assessments a where a.course_id=target_course_id and a.status in ('approved','published');
  return result;
end;
$$;
revoke all on function public.niu_list_assessments_for_learner(uuid,uuid) from public,anon;
grant execute on function public.niu_list_assessments_for_learner(uuid,uuid) to authenticated;
