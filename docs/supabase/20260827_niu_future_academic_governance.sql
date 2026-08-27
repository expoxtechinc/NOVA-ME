-- NIU future academic governance.
-- Existing rows remain governed_workflow = false and are not reclassified or changed.
-- Course Studio and future authoring flows opt new records into this stricter lifecycle.

alter table public.question_banks add column if not exists governed_workflow boolean not null default false;
alter table public.questions add column if not exists governed_workflow boolean not null default false;
alter table public.assessments add column if not exists governed_workflow boolean not null default false;
alter table public.assessments add column if not exists required_completion_rules jsonb;
alter table public.courses add column if not exists governed_workflow boolean not null default false;
alter table public.course_modules add column if not exists governed_workflow boolean not null default false;
alter table public.lessons add column if not exists governed_workflow boolean not null default false;
alter table public.content_library_items add column if not exists status text;
alter table public.content_library_items add column if not exists governed_workflow boolean not null default false;

alter table public.content_library_items drop constraint if exists content_library_items_status_check;
alter table public.content_library_items add constraint content_library_items_status_check check (status is null or status in ('draft', 'review', 'approved', 'published', 'archived'));

create table if not exists public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  title text not null,
  description text,
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived')),
  governed_workflow boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_key)
);

alter table public.certificate_templates enable row level security;
drop policy if exists certificate_templates_staff_only on public.certificate_templates;
create policy certificate_templates_staff_only on public.certificate_templates for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());

create or replace function public.niu_validate_future_governed_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_column text := coalesce(nullif(tg_argv[0], ''), 'status');
  current_status text := case when tg_op = 'UPDATE' then to_jsonb(old) ->> status_column else null end;
  next_status text := to_jsonb(new) ->> status_column;
  is_governed boolean := coalesce((to_jsonb(new) ->> 'governed_workflow')::boolean, false);
begin
  if not is_governed then return new; end if;
  if auth.uid() is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required for governed academic content';
  end if;
  if next_status not in ('draft', 'review', 'approved', 'published', 'archived') then
    raise exception 'Status must follow Draft, Review, Approved, Published, or Archived';
  end if;
  if tg_op = 'INSERT' then
    if next_status <> 'draft' then raise exception 'New governed content must start as Draft'; end if;
    return new;
  end if;
  if current_status = 'published' and next_status not in ('published', 'archived') then
    raise exception 'Published content cannot be returned to Draft or another earlier status';
  end if;
  if current_status = 'archived' and next_status <> 'archived' then
    raise exception 'Archived content cannot be reopened through this workflow';
  end if;
  if current_status = 'draft' and next_status not in ('draft', 'review') then
    raise exception 'Draft content must enter Review before approval';
  end if;
  if current_status = 'review' and next_status not in ('draft', 'review', 'approved') then
    raise exception 'Review content must be approved before publication';
  end if;
  if current_status = 'approved' and next_status not in ('approved', 'published', 'archived') then
    raise exception 'Approved content may only be Published or Archived';
  end if;
  if next_status in ('approved', 'published', 'archived') and not public.niu_is_administrator() then
    raise exception 'Administrator authorization is required for approval, publication, or archival';
  end if;
  return new;
end;
$$;

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
    if jsonb_typeof(rules) <> 'object' or jsonb_object_length(rules) = 0 then raise exception 'Assessment publication requires saved completion rules'; end if;
    select count(*), count(*) filter (where q.approval_status <> 'approved') into attached_count, unapproved_count from public.assessment_questions aq join public.questions q on q.id = aq.question_id where aq.assessment_id = new.id;
    if attached_count = 0 then raise exception 'Assessment publication requires at least one approved question'; end if;
    if unapproved_count > 0 then raise exception 'Assessment publication is blocked while attached questions are not approved'; end if;
  end if;
  return new;
end;
$$;

-- Replace the earlier question validator with the future governed transition and complete-metadata rules.
create or replace function public.niu_validate_question_bank_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  choice_count integer;
  correct_choice_id text;
  current_status text;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then raise exception 'Academic staff authorization is required'; end if;
  if new.approval_status not in ('draft', 'review', 'approved', 'published', 'archived', 'rejected') then raise exception 'Unsupported question approval status'; end if;
  if new.points is null or new.points <= 0 then raise exception 'Question points must be greater than zero'; end if;
  if new.question_type = 'multiple_choice' then
    select count(*) into choice_count from jsonb_array_elements(coalesce(new.choices, '[]'::jsonb)) as choice;
    if choice_count < 2 then raise exception 'Multiple-choice questions require at least two choices'; end if;
    correct_choice_id := new.answer_key ->> 'correct_choice_id';
    if correct_choice_id is null or not exists (select 1 from jsonb_array_elements(coalesce(new.choices, '[]'::jsonb)) as choice where choice ->> 'id' = correct_choice_id) then raise exception 'Multiple-choice questions require a valid correct answer'; end if;
  end if;
  if coalesce(new.governed_workflow, false) then
    if new.approval_status not in ('draft', 'review', 'approved', 'published', 'archived') then raise exception 'Governed questions use Draft, Review, Approved, Published, or Archived'; end if;
    if tg_op = 'INSERT' and new.approval_status <> 'draft' then raise exception 'New governed questions must start as Draft'; end if;
    if tg_op = 'UPDATE' then
      current_status := old.approval_status;
      if current_status = 'published' and new.approval_status not in ('published', 'archived') then raise exception 'Published questions cannot return to Draft'; end if;
      if current_status = 'archived' and new.approval_status <> 'archived' then raise exception 'Archived questions cannot be reopened'; end if;
      if current_status = 'draft' and new.approval_status not in ('draft', 'review') then raise exception 'Draft questions must enter Review before approval'; end if;
      if current_status = 'review' and new.approval_status not in ('draft', 'review', 'approved') then raise exception 'Review questions must be approved before publication'; end if;
      if current_status = 'approved' and new.approval_status not in ('approved', 'published', 'archived') then raise exception 'Approved questions may only be Published or Archived'; end if;
    end if;
    if new.approval_status in ('review', 'approved', 'published') then
      if char_length(trim(coalesce(new.topic, ''))) < 2 then raise exception 'Question review requires a topic'; end if;
      if char_length(trim(coalesce(new.learning_objective, ''))) < 2 then raise exception 'Question review requires a learning-objective mapping'; end if;
      if new.difficulty not in ('beginner', 'intermediate', 'advanced') then raise exception 'Question difficulty must be Beginner, Intermediate, or Advanced'; end if;
    end if;
    if new.approval_status in ('approved', 'published', 'archived') and not public.niu_is_administrator() then raise exception 'Administrator authorization is required for question approval, publication, or archival'; end if;
  else
    if new.approval_status = 'approved' and not public.niu_is_administrator() then raise exception 'Only an administrator or registrar may approve a question'; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.niu_require_approved_question_for_assessment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare question_status text;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then raise exception 'Academic staff authorization is required'; end if;
  select approval_status into question_status from public.questions where id = new.question_id;
  if question_status is null then raise exception 'Question was not found'; end if;
  if question_status not in ('approved', 'published') then raise exception 'Only approved or published questions may be attached to an assessment'; end if;
  return new;
end;
$$;

-- Future Course Studio records opt into this trigger. Existing rows remain unaffected.
drop trigger if exists niu_validate_future_question_bank_status on public.question_banks;
create trigger niu_validate_future_question_bank_status before insert or update on public.question_banks for each row execute function public.niu_validate_future_governed_status('status');
drop trigger if exists niu_validate_future_question_status on public.questions;
create trigger niu_validate_future_question_status before insert or update on public.questions for each row execute function public.niu_validate_question_bank_question();
drop trigger if exists niu_validate_future_assessment_status on public.assessments;
create trigger niu_validate_future_assessment_status before insert or update on public.assessments for each row execute function public.niu_validate_future_assessment();
drop trigger if exists niu_validate_future_course_status on public.courses;
create trigger niu_validate_future_course_status before insert or update on public.courses for each row execute function public.niu_validate_future_governed_status('status');
drop trigger if exists niu_validate_future_module_status on public.course_modules;
create trigger niu_validate_future_module_status before insert or update on public.course_modules for each row execute function public.niu_validate_future_governed_status('status');
drop trigger if exists niu_validate_future_lesson_status on public.lessons;
create trigger niu_validate_future_lesson_status before insert or update on public.lessons for each row execute function public.niu_validate_future_governed_status('status');
drop trigger if exists niu_validate_future_resource_status on public.content_library_items;
create trigger niu_validate_future_resource_status before insert or update on public.content_library_items for each row execute function public.niu_validate_future_governed_status('status');
drop trigger if exists niu_validate_future_certificate_template_status on public.certificate_templates;
create trigger niu_validate_future_certificate_template_status before insert or update on public.certificate_templates for each row execute function public.niu_validate_future_governed_status('status');
drop trigger if exists niu_require_approved_question_for_assessment on public.assessment_questions;
create trigger niu_require_approved_question_for_assessment before insert or update on public.assessment_questions for each row execute function public.niu_require_approved_question_for_assessment();

create unique index if not exists niu_future_assessment_title_key on public.assessments (course_id, coalesce(module_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(title))) where governed_workflow and status <> 'archived';
create unique index if not exists niu_future_question_bank_title_key on public.question_banks (coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(title))) where governed_workflow and status <> 'archived';
create unique index if not exists niu_future_resource_title_key on public.content_library_items (created_by, lower(btrim(title)), coalesce(file_name, '')) where governed_workflow and status <> 'archived';

-- Extend the established NIU audit ledger to every future-governed entity.
drop trigger if exists niu_audit_question_banks on public.question_banks;
create trigger niu_audit_question_banks after insert or update or delete on public.question_banks for each row execute function public.niu_capture_audit_event();
drop trigger if exists niu_audit_questions on public.questions;
create trigger niu_audit_questions after insert or update or delete on public.questions for each row execute function public.niu_capture_audit_event();
drop trigger if exists niu_audit_assessments on public.assessments;
create trigger niu_audit_assessments after insert or update or delete on public.assessments for each row execute function public.niu_capture_audit_event();
drop trigger if exists niu_audit_assessment_questions on public.assessment_questions;
create trigger niu_audit_assessment_questions after insert or update or delete on public.assessment_questions for each row execute function public.niu_capture_audit_event();
drop trigger if exists niu_audit_courses on public.courses;
create trigger niu_audit_courses after insert or update or delete on public.courses for each row execute function public.niu_capture_audit_event();
drop trigger if exists niu_audit_course_modules on public.course_modules;
create trigger niu_audit_course_modules after insert or update or delete on public.course_modules for each row execute function public.niu_capture_audit_event();
drop trigger if exists niu_audit_lessons on public.lessons;
create trigger niu_audit_lessons after insert or update or delete on public.lessons for each row execute function public.niu_capture_audit_event();
drop trigger if exists niu_audit_content_library_items on public.content_library_items;
create trigger niu_audit_content_library_items after insert or update or delete on public.content_library_items for each row execute function public.niu_capture_audit_event();
drop trigger if exists niu_audit_certificate_templates on public.certificate_templates;
create trigger niu_audit_certificate_templates after insert or update or delete on public.certificate_templates for each row execute function public.niu_capture_audit_event();

revoke all on function public.niu_validate_future_governed_status() from public, anon, authenticated;
revoke all on function public.niu_validate_future_assessment() from public, anon, authenticated;
revoke all on function public.niu_validate_question_bank_question() from public, anon, authenticated;
revoke all on function public.niu_require_approved_question_for_assessment() from public, anon, authenticated;

