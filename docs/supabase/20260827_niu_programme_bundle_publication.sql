-- Programme package readiness and controlled publication. All checks execute in the database.
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
  select count(distinct l.id) into required_material_total from public.program_courses pc join public.course_modules m on m.course_id = pc.course_id join public.lessons l on l.module_id = m.id left join public.lesson_content_library_items li on li.lesson_id = l.id where pc.program_id = target_program_id and l.is_required and li.lesson_id is not null;
  return jsonb_build_object('program_id', program_record.id, 'program_status', program_record.status, 'courses', course_total, 'approved_courses', approved_course_total, 'modules', module_total, 'approved_modules', approved_module_total, 'required_lessons', required_lesson_total, 'approved_required_lessons', approved_required_lesson_total, 'required_lessons_with_material', required_material_total, 'ready', course_total > 0 and course_total = approved_course_total and module_total > 0 and module_total = approved_module_total and required_lesson_total > 0 and required_lesson_total = approved_required_lesson_total and required_lesson_total = required_material_total);
end;
$$;

create or replace function public.niu_publish_programme_bundle(target_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare readiness jsonb;
begin
  if auth.uid() is null or not public.niu_is_administrator() then raise exception 'Administrator authorization is required'; end if;
  select public.niu_programme_bundle_readiness(target_program_id) into readiness;
  if coalesce(readiness ->> 'program_status', '') <> 'approved' then raise exception 'The certificate programme must be approved before its complete bundle can be published'; end if;
  if not coalesce((readiness ->> 'ready')::boolean, false) then raise exception 'This programme package is not ready. Complete and approve every required course, module, lesson, and material first.'; end if;
  update public.certificate_programs set status = 'published', published_at = now(), updated_at = now() where id = target_program_id and award_type = 'certificate';
  if not found then raise exception 'Only certificate programmes may be published'; end if;
  update public.courses set status = 'published', published_at = coalesce(published_at, now()), updated_at = now() where id in (select course_id from public.program_courses where program_id = target_program_id) and status = 'approved';
  update public.course_modules set status = 'published' where course_id in (select course_id from public.program_courses where program_id = target_program_id) and status = 'approved';
  update public.lessons set status = 'published' where module_id in (select m.id from public.course_modules m join public.program_courses pc on pc.course_id = m.course_id where pc.program_id = target_program_id) and status = 'approved';
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata) values (auth.uid(), 'programme_bundle_published', 'certificate_program', target_program_id, readiness);
  return readiness || jsonb_build_object('published', true);
end;
$$;

revoke all on function public.niu_programme_bundle_readiness(uuid) from public, anon;
revoke all on function public.niu_publish_programme_bundle(uuid) from public, anon;
grant execute on function public.niu_programme_bundle_readiness(uuid) to authenticated;
grant execute on function public.niu_publish_programme_bundle(uuid) to authenticated;
