-- The shared NIU audit trigger expects every row to have an `id` column.
-- Content attachments use a composite key, so they require this narrow
-- content-library-specific audit handler.

create or replace function public.niu_capture_content_library_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_subject_id text;
  event_subject_type text;
  event_metadata jsonb;
begin
  if tg_table_name = 'content_library_items' then
    event_subject_type := 'content_library_item';
    event_subject_id := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  elsif tg_table_name = 'lesson_content_items' then
    event_subject_type := 'lesson_content_item';
    event_subject_id := case when tg_op = 'DELETE' then old.content_item_id::text else new.content_item_id::text end;
  else
    raise exception 'Unsupported NIU content audit table: %', tg_table_name;
  end if;

  event_metadata := jsonb_build_object(
    'table', tg_table_name,
    'before', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    'after', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), tg_op, event_subject_type, event_subject_id, event_metadata);

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.niu_capture_content_library_audit_event() from public, anon, authenticated;

drop trigger if exists niu_audit_content_library_items on public.content_library_items;
create trigger niu_audit_content_library_items
after insert or update or delete on public.content_library_items
for each row execute function public.niu_capture_content_library_audit_event();

drop trigger if exists niu_audit_lesson_content_items on public.lesson_content_items;
create trigger niu_audit_lesson_content_items
after insert or update or delete on public.lesson_content_items
for each row execute function public.niu_capture_content_library_audit_event();
