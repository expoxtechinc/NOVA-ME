create or replace function public.niu_allowlist_role_for_email(target_email text)
returns public.app_role
language plpgsql
stable
security definer
set search_path = public
as $$
declare listed_role text;
begin
  select lower(role::text) into listed_role from public.admin_allowlist where lower(email) = lower(target_email) limit 1;
  return case listed_role
    when 'super_admin' then 'super_admin'::public.app_role
    when 'administrator' then 'administrator'::public.app_role
    when 'admin' then 'administrator'::public.app_role
    when 'instructor' then 'instructor'::public.app_role
    else 'student'::public.app_role
  end;
end;
$$;

create or replace function public.niu_provision_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare mapped_role public.app_role;
declare listed boolean;
begin
  mapped_role := public.niu_allowlist_role_for_email(new.email);
  listed := exists (select 1 from public.admin_allowlist where lower(email) = lower(new.email));
  insert into public.profiles (id, email, display_name, legal_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    mapped_role
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    legal_name = coalesce(excluded.legal_name, public.profiles.legal_name),
    role = case when listed then excluded.role else public.profiles.role end,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.niu_sync_profile_role_from_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target_email text;
begin
  target_email := coalesce(new.email, old.email);
  update public.profiles
  set role = public.niu_allowlist_role_for_email(target_email), updated_at = now()
  where lower(email) = lower(target_email);
  return coalesce(new, old);
end;
$$;

drop trigger if exists niu_auth_profile_provision on auth.users;
create trigger niu_auth_profile_provision
after insert on auth.users
for each row execute function public.niu_provision_profile_from_auth();

drop trigger if exists niu_allowlist_profile_role_sync on public.admin_allowlist;
create trigger niu_allowlist_profile_role_sync
after insert or update or delete on public.admin_allowlist
for each row execute function public.niu_sync_profile_role_from_allowlist();

revoke all on function public.niu_allowlist_role_for_email(text) from public, anon, authenticated;
revoke all on function public.niu_provision_profile_from_auth() from public, anon, authenticated;
revoke all on function public.niu_sync_profile_role_from_allowlist() from public, anon, authenticated;
