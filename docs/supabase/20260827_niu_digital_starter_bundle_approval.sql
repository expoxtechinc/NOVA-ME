-- NIU controlled approval for the specifically authorised first certificate bundle.
-- Publication remains a separate existing quality-gate function.

create or replace function public.niu_approve_digital_starter_bundle()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_program_id uuid;
  v_course_id uuid;
  v_module_count integer;
  v_lesson_count integer;
  v_material_count integer;
begin
  if not public.niu_is_active_super_admin() then
    raise exception 'Active Super Administrator authority is required';
  end if;

  select p.id, c.id
  into v_program_id, v_course_id
  from public.certificate_programs p
  join public.program_courses pc on pc.program_id = p.id
  join public.courses c on c.id = pc.course_id
  where p.code = 'DSERW-CERT'
    and p.award_type = 'certificate'
    and c.slug = 'digital-foundations-enterprise-remote-work';

  if v_program_id is null or v_course_id is null then
    raise exception 'The authorised NIU starter certificate structure is not available';
  end if;

  select count(*) into v_module_count from public.course_modules where course_id = v_course_id;
  select count(*) into v_lesson_count from public.lessons l join public.course_modules m on m.id = l.module_id where m.course_id = v_course_id and l.is_required;
  select count(distinct l.id) into v_material_count from public.lessons l join public.course_modules m on m.id = l.module_id join public.lesson_content_items attachment on attachment.lesson_id = l.id where m.course_id = v_course_id and l.is_required;

  if v_module_count <> 4 or v_lesson_count <> 4 or v_material_count <> 4 then
    raise exception 'The first NIU certificate bundle requires four modules, four required lessons, and protected material attached to every required lesson before approval';
  end if;

  update public.course_modules set status = 'approved' where course_id = v_course_id and status = 'draft';
  update public.lessons set status = 'approved' where module_id in (select id from public.course_modules where course_id = v_course_id) and status = 'draft';
  update public.courses set status = 'approved', updated_at = now() where id = v_course_id and status = 'draft';
  update public.certificate_programs set status = 'approved', updated_at = now() where id = v_program_id and status = 'draft';

  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), 'digital_starter_bundle_approved', 'certificate_program', v_program_id, jsonb_build_object('course_id', v_course_id, 'module_count', v_module_count, 'required_lesson_count', v_lesson_count, 'required_lessons_with_material', v_material_count, 'award_type', 'certificate'));

  return public.niu_programme_bundle_readiness(v_program_id);
end;
$$;

revoke all on function public.niu_approve_digital_starter_bundle() from public, anon;
grant execute on function public.niu_approve_digital_starter_bundle() to authenticated;
