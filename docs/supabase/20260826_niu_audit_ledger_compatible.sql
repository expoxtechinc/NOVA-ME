create index if not exists audit_events_niu_subject_idx on public.audit_events(subject_type, subject_id, created_at desc);
create index if not exists audit_events_niu_actor_idx on public.audit_events(actor_id, created_at desc);

create or replace function public.niu_capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare event_subject_id text;
begin
  if tg_op = 'DELETE' then
    event_subject_id := old.id::text;
    insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
    values (auth.uid(), tg_op, tg_table_name, event_subject_id, jsonb_build_object('before', to_jsonb(old)));
    return old;
  end if;

  event_subject_id := new.id::text;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (
    auth.uid(), tg_op, tg_table_name, event_subject_id,
    case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)) else jsonb_build_object('after', to_jsonb(new)) end
  );
  return new;
end;
$$;

do $$
declare target_table text;
begin
  foreach target_table in array array['schools','departments','certificate_programs','course_versions','assessments','assignments','certificate_candidates','gradebook_entries','certificates','institution_settings']
  loop
    execute format('drop trigger if exists niu_audit_%1$s on public.%1$s', target_table);
    execute format('create trigger niu_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.niu_capture_audit_event()', target_table);
  end loop;
end $$;

alter table public.audit_events enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_events' and policyname = 'audit_events_niu_administrator_read') then
    create policy audit_events_niu_administrator_read on public.audit_events for select to authenticated using (public.niu_is_administrator());
  end if;
end $$;

revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
