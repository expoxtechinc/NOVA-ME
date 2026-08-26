-- Require a prior NIU allowlist record before Supabase Auth can create an account.
-- This applies equally to email-link, Google OAuth, and any future Auth provider.
create or replace function public.niu_require_allowlisted_auth_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null
     or not exists (
       select 1
       from public.admin_allowlist
       where lower(email) = lower(new.email)
     ) then
    raise exception 'NIU access requires a prior approved allowlist record.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists niu_auth_require_allowlisted_email on auth.users;
create trigger niu_auth_require_allowlisted_email
before insert on auth.users
for each row execute function public.niu_require_allowlisted_auth_email();

revoke all on function public.niu_require_allowlisted_auth_email() from public, anon, authenticated;
