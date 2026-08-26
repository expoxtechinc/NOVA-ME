create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  resource_type text not null,
  resource_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_resource_idx on public.audit_events(resource_type, resource_id, created_at desc);
create index if not exists audit_events_actor_idx on public.audit_events(actor_id, created_at desc);

create or replace function public.niu_capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare event_resource_id uuid;
begin
  event_resource_id := case when tg_op = 'DELETE' then old.id else new.id end;
  insert into public.audit_events (actor_id, action, resource_type, resource_id, before_data, after_data)
  values (
    auth.uid(), tg_op, tg_table_name, event_resource_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return case when tg_op = 'DELETE' then old else new end;
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
create policy audit_events_administrator_read on public.audit_events for select to authenticated using (public.niu_is_administrator());
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
