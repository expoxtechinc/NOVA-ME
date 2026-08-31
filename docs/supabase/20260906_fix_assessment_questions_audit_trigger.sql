-- Fix the audit trigger for assessment_questions, whose primary key is composite.
-- assessment_questions has no id column; its identity is assessment_id + question_id.
-- No academic records are created, updated, deleted, or re-seeded by this migration.

create or replace function public.niu_capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_subject_id text;
begin
  if tg_table_name = 'assessment_questions' then
    if tg_op = 'DELETE' then
      event_subject_id := format('%s:%s', old.assessment_id, old.question_id);
    else
      event_subject_id := format('%s:%s', new.assessment_id, new.question_id);
    end if;
  elsif tg_op = 'DELETE' then
    event_subject_id := old.id::text;
  else
    event_subject_id := new.id::text;
  end if;

  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    event_subject_id,
    case
      when tg_op = 'DELETE' then jsonb_build_object('before', to_jsonb(old))
      when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      else jsonb_build_object('after', to_jsonb(new))
    end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.niu_capture_audit_event() from public, anon, authenticated;
