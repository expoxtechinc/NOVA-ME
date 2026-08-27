-- Accountable policy workflow: staff can read policies, while changes flow through audited functions.
alter table public.policy_pages add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.policy_pages add column if not exists reviewed_at timestamptz;

drop policy if exists policy_pages_staff_manage on public.policy_pages;
create policy policy_pages_staff_read on public.policy_pages for select to authenticated using (public.niu_is_academic_staff());
create policy policy_pages_direct_insert_denied on public.policy_pages for insert to authenticated with check (false);
create policy policy_pages_direct_update_denied on public.policy_pages for update to authenticated using (false) with check (false);
create policy policy_pages_direct_delete_denied on public.policy_pages for delete to authenticated using (false);

create or replace function public.niu_create_policy_page(target_slug text, target_title text, target_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare created_policy public.policy_pages;
begin
  if auth.uid() is null or not public.niu_is_administrator() then raise exception 'Administrator authorization is required'; end if;
  if target_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Policy URL slug is invalid'; end if;
  if char_length(trim(target_title)) not between 3 and 255 then raise exception 'Policy title must contain between 3 and 255 characters'; end if;
  if char_length(trim(target_body)) not between 30 and 50000 then raise exception 'Policy body must contain between 30 and 50000 characters'; end if;
  insert into public.policy_pages (slug, title, body, status, authored_by)
  values (lower(trim(target_slug)), trim(target_title), trim(target_body), 'draft', auth.uid())
  returning * into created_policy;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), 'policy_page_created', 'policy_page', created_policy.id, jsonb_build_object('slug', created_policy.slug, 'status', created_policy.status));
  return jsonb_build_object('id', created_policy.id, 'status', created_policy.status, 'slug', created_policy.slug);
end;
$$;

create or replace function public.niu_update_policy_page(target_policy_id uuid, target_title text, target_body text, target_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare policy_record public.policy_pages; current_is_admin boolean; updated_policy public.policy_pages;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then raise exception 'Academic staff authorization is required'; end if;
  select * into policy_record from public.policy_pages where id = target_policy_id;
  if not found then raise exception 'Policy page not found'; end if;
  current_is_admin := public.niu_is_administrator();
  if not current_is_admin and policy_record.authored_by is distinct from auth.uid() then raise exception 'Only the policy author or an administrator may revise this policy'; end if;
  if target_status not in ('draft', 'review', 'approved', 'published', 'archived') then raise exception 'Unsupported policy publication status'; end if;
  if target_status in ('approved', 'published', 'archived') and not current_is_admin then raise exception 'Administrator approval is required for this policy status'; end if;
  if char_length(trim(target_title)) not between 3 and 255 or char_length(trim(target_body)) not between 30 and 50000 then raise exception 'Policy title or body is outside NIU limits'; end if;
  update public.policy_pages
  set title = trim(target_title), body = trim(target_body), status = target_status,
      reviewed_by = case when target_status in ('approved', 'published', 'archived') then auth.uid() else reviewed_by end,
      reviewed_at = case when target_status in ('approved', 'published', 'archived') then now() else reviewed_at end,
      published_at = case when target_status = 'published' then coalesce(published_at, now()) else published_at end,
      updated_at = now()
  where id = target_policy_id
  returning * into updated_policy;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), 'policy_page_updated', 'policy_page', updated_policy.id, jsonb_build_object('status', updated_policy.status, 'slug', updated_policy.slug));
  return jsonb_build_object('id', updated_policy.id, 'status', updated_policy.status, 'slug', updated_policy.slug);
end;
$$;

revoke all on function public.niu_create_policy_page(text, text, text) from public, anon;
revoke all on function public.niu_update_policy_page(uuid, text, text, text) from public, anon;
grant execute on function public.niu_create_policy_page(text, text, text) to authenticated;
grant execute on function public.niu_update_policy_page(uuid, text, text, text) to authenticated;
