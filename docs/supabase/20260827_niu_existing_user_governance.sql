-- Record-preserving existing-user role reassignment and scoped course-assignment controls.
create table if not exists public.staff_course_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  assignment_type text not null check (assignment_type in ('instructor', 'content_author', 'assessor', 'grader', 'registrar_support')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  unique (profile_id, course_id, assignment_type)
);
alter table public.staff_course_assignments enable row level security;
create policy "staff can see their course assignments" on public.staff_course_assignments for select to authenticated using (profile_id = auth.uid() or public.niu_is_administrator());
create policy "administrators manage course assignments" on public.staff_course_assignments for all to authenticated using (public.niu_is_administrator()) with check (public.niu_is_administrator());

create or replace function public.niu_reassign_profile_role(target_profile_id uuid, target_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare target_email text;
begin
  if auth.uid() is null or not public.niu_is_administrator() then raise exception 'Super Administrator authorization is required'; end if;
  if target_profile_id = auth.uid() then raise exception 'You cannot change your own role through this control'; end if;
  if target_role not in ('student', 'instructor', 'administrator', 'super_admin') then raise exception 'Unsupported NIU role'; end if;
  select email into target_email from public.profiles where id = target_profile_id;
  if not found then raise exception 'NIU profile not found'; end if;
  update public.profiles set role = target_role::public.user_role, updated_at = now() where id = target_profile_id;
  if target_role = 'student' then delete from public.admin_allowlist where email = target_email;
  else insert into public.admin_allowlist (email, role) values (target_email, target_role) on conflict (email) do update set role = excluded.role; end if;
  insert into public.profile_role_assignments (profile_id, institutional_role, assigned_by, assigned_at) values (target_profile_id, target_role, auth.uid(), now()) on conflict (profile_id, institutional_role) do update set assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata) values (auth.uid(), 'profile_role_reassigned', 'profile', target_profile_id, jsonb_build_object('role', target_role));
  return jsonb_build_object('profile_id', target_profile_id, 'role', target_role);
end;
$$;
revoke all on function public.niu_reassign_profile_role(uuid, text) from public, anon;
grant execute on function public.niu_reassign_profile_role(uuid, text) to authenticated;
