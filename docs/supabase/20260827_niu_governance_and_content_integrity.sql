-- Preserve the distinction between core profiles.role and constrained institutional-role assignments.
-- Also correct the programme readiness material join to the protected lesson-content junction.
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
  if target_role = 'student' then
    delete from public.admin_allowlist where email = target_email;
  else
    insert into public.admin_allowlist (email, role) values (target_email, target_role)
    on conflict (email) do update set role = excluded.role;
  end if;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), 'profile_role_reassigned', 'profile', target_profile_id, jsonb_build_object('role', target_role));
  return jsonb_build_object('profile_id', target_profile_id, 'role', target_role);
end;
$$;

create or replace function public.niu_programme_bundle_readiness(target_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare course_total integer; approved_course_total integer; module_total integer; approved_module_total integer; required_lesson_total integer; approved_required_lesson_total integer; required_material_total integer; program_record public.certificate_programs;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then raise exception 'Academic staff authorization is required'; end if;
  select * into program_record from public.certificate_programs where id = target_program_id;
  if not found then raise exception 'Certificate programme not found'; end if;
  select count(*), count(*) filter (where c.status in ('approved', 'published')) into course_total, approved_course_total from public.program_courses pc join public.courses c on c.id = pc.course_id where pc.program_id = target_program_id;
  select count(*), count(*) filter (where m.status in ('approved', 'published')) into module_total, approved_module_total from public.program_courses pc join public.course_modules m on m.course_id = pc.course_id where pc.program_id = target_program_id;
  select count(*), count(*) filter (where l.status in ('approved', 'published')) into required_lesson_total, approved_required_lesson_total from public.program_courses pc join public.course_modules m on m.course_id = pc.course_id join public.lessons l on l.module_id = m.id where pc.program_id = target_program_id and l.is_required;
  select count(distinct l.id) into required_material_total from public.program_courses pc join public.course_modules m on m.course_id = pc.course_id join public.lessons l on l.module_id = m.id left join public.lesson_content_items li on li.lesson_id = l.id where pc.program_id = target_program_id and l.is_required and li.lesson_id is not null;
  return jsonb_build_object('program_id', program_record.id, 'program_status', program_record.status, 'courses', course_total, 'approved_courses', approved_course_total, 'modules', module_total, 'approved_modules', approved_module_total, 'required_lessons', required_lesson_total, 'approved_required_lessons', approved_required_lesson_total, 'required_lessons_with_material', required_material_total, 'ready', course_total > 0 and course_total = approved_course_total and module_total > 0 and module_total = approved_module_total and required_lesson_total > 0 and required_lesson_total = approved_required_lesson_total and required_lesson_total = required_material_total);
end;
$$;

revoke all on function public.niu_reassign_profile_role(uuid, text) from public, anon;
revoke all on function public.niu_programme_bundle_readiness(uuid) from public, anon;
grant execute on function public.niu_reassign_profile_role(uuid, text) to authenticated;
grant execute on function public.niu_programme_bundle_readiness(uuid) to authenticated;
