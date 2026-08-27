-- Public registration creates a student profile through the existing auth-profile trigger.
-- Staff elevation remains solely dependent on an administrator-controlled allowlist entry.
drop trigger if exists niu_auth_require_allowlisted_email on auth.users;

drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_manage_super_admin on public.profiles;
create policy profiles_direct_insert_denied on public.profiles for insert to authenticated with check (false);
create policy profiles_direct_update_denied on public.profiles for update to authenticated using (false) with check (false);
create policy profiles_direct_delete_denied on public.profiles for delete to authenticated using (false);

create or replace function public.niu_update_profile_account_status(target_profile_id uuid, target_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare target_profile public.profiles;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin' and account_status = 'active') then raise exception 'Active Super Administrator authorization is required'; end if;
  if target_status not in ('active', 'suspended', 'inactive') then raise exception 'Unsupported account status'; end if;
  if target_profile_id = auth.uid() and target_status <> 'active' then raise exception 'You cannot suspend or deactivate your own active Super Administrator account'; end if;
  update public.profiles set account_status = target_status, updated_at = now() where id = target_profile_id returning * into target_profile;
  if not found then raise exception 'NIU profile not found'; end if;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), 'profile_account_status_updated', 'profile', target_profile_id, jsonb_build_object('account_status', target_status));
  return jsonb_build_object('profile_id', target_profile_id, 'account_status', target_status);
end;
$$;

revoke all on function public.niu_update_profile_account_status(uuid, text) from public, anon;
grant execute on function public.niu_update_profile_account_status(uuid, text) to authenticated;
