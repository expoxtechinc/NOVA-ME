-- PostgreSQL-compatible JSONB readiness validation.
-- Uses jsonb_each because key enumeration is supported in this Supabase environment.
-- No academic records are created, updated, deleted, or re-seeded.

create or replace function public.niu_validate_future_assessment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attached_count integer;
  unapproved_count integer;
  rules jsonb;
begin
  if not coalesce(new.governed_workflow, false) then return new; end if;
  if auth.uid() is null or not public.niu_is_academic_staff() then raise exception 'Academic staff authorization is required for governed academic content'; end if;
  if new.status not in ('draft', 'review', 'approved', 'published', 'archived') then raise exception 'Status must follow Draft, Review, Approved, Published, or Archived'; end if;
  if tg_op = 'INSERT' and new.status <> 'draft' then raise exception 'New governed assessments must start as Draft'; end if;
  if tg_op = 'UPDATE' and old.status = 'published' and new.status not in ('published', 'archived') then raise exception 'Published assessments cannot be returned to Draft or another earlier status'; end if;
  if tg_op = 'UPDATE' and old.status = 'archived' and new.status <> 'archived' then raise exception 'Archived assessments cannot be reopened'; end if;
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status not in ('draft', 'review') then raise exception 'Draft assessments must enter Review before approval'; end if;
  if tg_op = 'UPDATE' and old.status = 'review' and new.status not in ('draft', 'review', 'approved') then raise exception 'Review assessments must be approved before publication'; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' and new.status not in ('approved', 'published', 'archived') then raise exception 'Approved assessments may only be Published or Archived'; end if;
  if new.status in ('approved', 'published', 'archived') and not public.niu_is_administrator() then raise exception 'Administrator authorization is required for approval, publication, or archival'; end if;
  if new.status in ('approved', 'published') then
    if char_length(trim(new.title)) not between 3 and 255 then raise exception 'Assessment title must contain between 3 and 255 characters'; end if;
    if new.passing_score is null or new.passing_score <= 0 or new.passing_score > 100 then raise exception 'Assessment passing score must be greater than 0 and no more than 100'; end if;
    if new.time_limit_minutes is null or new.time_limit_minutes <= 0 then raise exception 'Assessment publication requires a positive time limit in minutes'; end if;
    if new.attempt_limit is null or new.attempt_limit <= 0 then raise exception 'Assessment publication requires a positive attempt limit'; end if;
    rules := coalesce(new.required_completion_rules, '{}'::jsonb);
    if jsonb_typeof(rules) <> 'object' or not exists (select 1 from jsonb_each(rules) as rule(key, value)) then raise exception 'Assessment publication requires saved completion rules'; end if;
    select count(*), count(*) filter (where q.approval_status <> 'approved') into attached_count, unapproved_count from public.assessment_questions aq join public.questions q on q.id = aq.question_id where aq.assessment_id = new.id;
    if attached_count = 0 then raise exception 'Assessment publication requires at least one approved question'; end if;
    if unapproved_count > 0 then raise exception 'Assessment publication is blocked while attached questions are not approved'; end if;
  end if;
  return new;
end;
$$;

revoke all on function public.niu_validate_future_assessment() from public, anon, authenticated;
