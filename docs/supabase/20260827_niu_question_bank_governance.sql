-- NIU governed Question Bank extension.
-- Additive and data-preserving: no question, assessment, or curriculum rows are created or changed.

alter table public.questions
  add column if not exists topic text,
  add column if not exists learning_objective text,
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists approved_at timestamptz;

create index if not exists questions_bank_approval_idx
  on public.questions (question_bank_id, approval_status, created_at desc);

create or replace function public.niu_validate_question_bank_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  choice_count integer;
  correct_choice_id text;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required';
  end if;

  if new.approval_status not in ('draft', 'review', 'approved', 'rejected', 'archived') then
    raise exception 'Unsupported question approval status';
  end if;

  if new.points is null or new.points <= 0 then
    raise exception 'Question points must be greater than zero';
  end if;

  if new.question_type = 'multiple_choice' then
    select count(*) into choice_count
      from jsonb_array_elements(coalesce(new.choices, '[]'::jsonb)) as choice;
    if choice_count < 2 then
      raise exception 'Multiple-choice questions require at least two choices';
    end if;
    correct_choice_id := new.answer_key ->> 'correct_choice_id';
    if correct_choice_id is null or not exists (
      select 1
      from jsonb_array_elements(coalesce(new.choices, '[]'::jsonb)) as choice
      where choice ->> 'id' = correct_choice_id
    ) then
      raise exception 'Multiple-choice questions require a valid correct answer';
    end if;
  end if;

  if new.approval_status = 'approved' and not public.niu_is_administrator() then
    raise exception 'Only an administrator or registrar may approve a question';
  end if;

  if new.approval_status = 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := coalesce(new.approved_at, now());
  elsif tg_op = 'UPDATE' and old.approval_status = 'approved' and new.approval_status <> 'approved' then
    new.approved_by := null;
    new.approved_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists niu_validate_question_bank_question on public.questions;
create trigger niu_validate_question_bank_question
before insert or update on public.questions
for each row execute function public.niu_validate_question_bank_question();

create or replace function public.niu_require_approved_question_for_assessment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  question_status text;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required';
  end if;
  select approval_status into question_status from public.questions where id = new.question_id;
  if question_status is null then
    raise exception 'Question was not found';
  end if;
  if question_status <> 'approved' then
    raise exception 'Only approved questions may be attached to an assessment';
  end if;
  return new;
end;
$$;

drop trigger if exists niu_require_approved_question_for_assessment on public.assessment_questions;
create trigger niu_require_approved_question_for_assessment
before insert or update on public.assessment_questions
for each row execute function public.niu_require_approved_question_for_assessment();

-- Preserve the established audit ledger for question-bank governance and attachment changes.
drop trigger if exists niu_audit_question_banks on public.question_banks;
create trigger niu_audit_question_banks
after insert or update or delete on public.question_banks
for each row execute function public.niu_capture_audit_event();

drop trigger if exists niu_audit_questions on public.questions;
create trigger niu_audit_questions
after insert or update or delete on public.questions
for each row execute function public.niu_capture_audit_event();

drop trigger if exists niu_audit_assessment_questions on public.assessment_questions;
create trigger niu_audit_assessment_questions
after insert or update or delete on public.assessment_questions
for each row execute function public.niu_capture_audit_event();

revoke all on function public.niu_validate_question_bank_question() from public, anon, authenticated;
revoke all on function public.niu_require_approved_question_for_assessment() from public, anon, authenticated;
