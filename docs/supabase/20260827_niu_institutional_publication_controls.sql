-- Add accountable publication metadata without changing existing public calendar visibility.
alter table public.schools add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.schools add column if not exists reviewed_at timestamptz;
alter table public.schools add column if not exists published_by uuid references public.profiles(id) on delete set null;
alter table public.schools add column if not exists published_at timestamptz;

alter table public.departments add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.departments add column if not exists reviewed_at timestamptz;
alter table public.departments add column if not exists published_by uuid references public.profiles(id) on delete set null;
alter table public.departments add column if not exists published_at timestamptz;

alter table public.academic_calendar_events add column if not exists status text not null default 'published' check (status in ('draft', 'review', 'approved', 'published', 'archived'));
alter table public.academic_calendar_events alter column status set default 'draft';
alter table public.academic_calendar_events add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.academic_calendar_events add column if not exists reviewed_at timestamptz;
alter table public.academic_calendar_events add column if not exists published_by uuid references public.profiles(id) on delete set null;
alter table public.academic_calendar_events add column if not exists published_at timestamptz;

drop policy if exists schools_staff_manage on public.schools;
create policy schools_staff_create_unpublished on public.schools for insert to authenticated with check (public.niu_is_academic_staff() and status <> 'published');
create policy schools_direct_update_denied on public.schools for update to authenticated using (false) with check (false);
create policy schools_direct_delete_denied on public.schools for delete to authenticated using (false);

drop policy if exists departments_staff_manage on public.departments;
create policy departments_staff_create_unpublished on public.departments for insert to authenticated with check (public.niu_is_academic_staff() and status <> 'published');
create policy departments_direct_update_denied on public.departments for update to authenticated using (false) with check (false);
create policy departments_direct_delete_denied on public.departments for delete to authenticated using (false);

drop policy if exists calendar_public on public.academic_calendar_events;
drop policy if exists calendar_staff_manage on public.academic_calendar_events;
create policy calendar_public_published on public.academic_calendar_events for select to anon, authenticated using (status = 'published' or public.niu_is_academic_staff());
create policy calendar_staff_create_unpublished on public.academic_calendar_events for insert to authenticated with check (public.niu_is_academic_staff() and status <> 'published' and created_by = auth.uid());
create policy calendar_direct_update_denied on public.academic_calendar_events for update to authenticated using (false) with check (false);
create policy calendar_direct_delete_denied on public.academic_calendar_events for delete to authenticated using (false);

create or replace function public.niu_update_institutional_publication(target_record_type text, target_record_id uuid, target_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare record_status text;
begin
  if auth.uid() is null or not public.niu_is_administrator() then raise exception 'Administrator authorization is required'; end if;
  if target_record_type not in ('school', 'department', 'calendar_event') then raise exception 'Unsupported institutional record type'; end if;
  if target_status not in ('draft', 'review', 'approved', 'published', 'archived') then raise exception 'Unsupported publication status'; end if;
  if target_record_type = 'school' then
    update public.schools set status = target_status, reviewed_by = case when target_status in ('approved', 'published', 'archived') then auth.uid() else reviewed_by end, reviewed_at = case when target_status in ('approved', 'published', 'archived') then now() else reviewed_at end, published_by = case when target_status = 'published' then auth.uid() else published_by end, published_at = case when target_status = 'published' then coalesce(published_at, now()) else published_at end, updated_at = now() where id = target_record_id returning status into record_status;
  elsif target_record_type = 'department' then
    update public.departments set status = target_status, reviewed_by = case when target_status in ('approved', 'published', 'archived') then auth.uid() else reviewed_by end, reviewed_at = case when target_status in ('approved', 'published', 'archived') then now() else reviewed_at end, published_by = case when target_status = 'published' then auth.uid() else published_by end, published_at = case when target_status = 'published' then coalesce(published_at, now()) else published_at end, updated_at = now() where id = target_record_id returning status into record_status;
  else
    update public.academic_calendar_events set status = target_status, reviewed_by = case when target_status in ('approved', 'published', 'archived') then auth.uid() else reviewed_by end, reviewed_at = case when target_status in ('approved', 'published', 'archived') then now() else reviewed_at end, published_by = case when target_status = 'published' then auth.uid() else published_by end, published_at = case when target_status = 'published' then coalesce(published_at, now()) else published_at end where id = target_record_id returning status into record_status;
  end if;
  if not found then raise exception 'Institutional record not found'; end if;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), 'institutional_record_publication_updated', target_record_type, target_record_id, jsonb_build_object('status', record_status));
  return jsonb_build_object('record_type', target_record_type, 'record_id', target_record_id, 'status', record_status);
end;
$$;

revoke all on function public.niu_update_institutional_publication(text, uuid, text) from public, anon;
grant execute on function public.niu_update_institutional_publication(text, uuid, text) to authenticated;
