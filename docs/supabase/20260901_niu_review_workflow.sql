-- Governed Draft -> Review -> Approved workflow for Programme Builder records.
-- Live schema inspection: courses.status is public.course_status; related status columns are text.
-- The validated course transition is explicitly cast to public.course_status; no enum is altered.
-- Every transition is scoped to one record and writes an audit ledger event.
create or replace function public.niu_transition_academic_record(target_type text, target_id uuid, target_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  before_record jsonb;
  after_record jsonb;
  resource_type text := target_type;
  current_status text;
begin
  if actor is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required';
  end if;
  if target_type not in ('course', 'module', 'lesson', 'assessment', 'certificate_template') then
    raise exception 'Unsupported academic record type';
  end if;
  if target_status not in ('review', 'approved') then
    raise exception 'Only Review and Approved transitions are available';
  end if;

  if target_type = 'course' then
    select to_jsonb(c), c.status into before_record, current_status from public.courses c where c.id = target_id;
    if before_record is null then raise exception 'Course not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft', 'review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.courses set status = (target_status)::public.course_status, updated_at = now() where id = target_id returning to_jsonb(courses) into after_record;
  elsif target_type = 'module' then
    select to_jsonb(m), m.status into before_record, current_status from public.course_modules m where m.id = target_id;
    if before_record is null then raise exception 'Module not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft', 'review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.course_modules set status = target_status::text where id = target_id returning to_jsonb(course_modules) into after_record;
  elsif target_type = 'lesson' then
    select to_jsonb(l), l.status into before_record, current_status from public.lessons l where l.id = target_id;
    if before_record is null then raise exception 'Lesson not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft', 'review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.lessons set status = target_status::text where id = target_id returning to_jsonb(lessons) into after_record;
  elsif target_type = 'assessment' then
    select to_jsonb(a), a.status into before_record, current_status from public.assessments a where a.id = target_id;
    if before_record is null then raise exception 'Assessment not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft', 'review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.assessments set status = target_status::text, updated_at = now() where id = target_id returning to_jsonb(assessments) into after_record;
  else
    select to_jsonb(t), t.status into before_record, current_status from public.certificate_templates t where t.id = target_id;
    if before_record is null then raise exception 'Certificate template not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft', 'review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.certificate_templates set status = target_status::text, updated_at = now() where id = target_id returning to_jsonb(certificate_templates) into after_record;
  end if;

  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (actor, 'UPDATE', resource_type, target_id, jsonb_build_object('event', 'academic_record_status_changed', 'from', current_status, 'to', target_status, 'before', before_record, 'after', after_record));

  return jsonb_build_object('record_type', resource_type, 'record_id', target_id, 'status', target_status, 'audit_recorded', true);
end;
$function$;

revoke all on function public.niu_transition_academic_record(text, uuid, text) from public, anon;
grant execute on function public.niu_transition_academic_record(text, uuid, text) to authenticated;

drop function if exists public.niu_approve_academic_record(text, uuid);

-- Keep the short PMF package exact: one required approved course, module, and lesson,
-- one protected material, one governed assessment, and one certificate template.
create or replace function public.niu_programme_bundle_readiness(target_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $readiness$
declare
  course_total integer;
  approved_course_total integer;
  module_total integer;
  approved_module_total integer;
  required_lesson_total integer;
  approved_required_lesson_total integer;
  required_material_total integer;
  governed_assessment_total integer;
  ready_governed_assessment_total integer;
  template_total integer;
  approved_template_total integer;
  program_record public.certificate_programs;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then raise exception 'Academic staff authorization is required'; end if;
  select * into program_record from public.certificate_programs where id = target_program_id;
  if not found then raise exception 'Certificate programme not found'; end if;
  select count(*) filter (where pc.is_required), count(*) filter (where pc.is_required and c.status in ('approved','published')) into course_total, approved_course_total from public.program_courses pc join public.courses c on c.id = pc.course_id where pc.program_id = target_program_id;
  select count(*), count(*) filter (where m.status in ('approved','published')) into module_total, approved_module_total from public.program_courses pc join public.course_modules m on m.course_id = pc.course_id where pc.program_id = target_program_id and pc.is_required;
  select count(*), count(*) filter (where l.status in ('approved','published')) into required_lesson_total, approved_required_lesson_total from public.program_courses pc join public.course_modules m on m.course_id = pc.course_id join public.lessons l on l.module_id = m.id where pc.program_id = target_program_id and pc.is_required and l.is_required;
  select count(distinct l.id) into required_material_total from public.program_courses pc join public.course_modules m on m.course_id = pc.course_id join public.lessons l on l.module_id = m.id join public.lesson_content_items li on li.lesson_id = l.id where pc.program_id = target_program_id and pc.is_required and l.is_required;
  select count(*) into governed_assessment_total from public.program_courses pc join public.assessments a on a.course_id = pc.course_id where pc.program_id = target_program_id and pc.is_required and a.governed_workflow;
  select count(*) into ready_governed_assessment_total from public.program_courses pc join public.assessments a on a.course_id = pc.course_id where pc.program_id = target_program_id and pc.is_required and a.governed_workflow and a.status in ('approved','published');
  select count(*), count(*) filter (where t.status in ('approved','published')) into template_total, approved_template_total from public.certificate_templates t where t.template_key = program_record.certificate_template_key and t.governed_workflow;
  return jsonb_build_object('program_id', program_record.id, 'program_status', program_record.status, 'courses', course_total, 'approved_courses', approved_course_total, 'modules', module_total, 'approved_modules', approved_module_total, 'required_lessons', required_lesson_total, 'approved_required_lessons', approved_required_lesson_total, 'required_lessons_with_material', required_material_total, 'governed_assessments', governed_assessment_total, 'ready_governed_assessments', ready_governed_assessment_total, 'certificate_templates', template_total, 'approved_certificate_templates', approved_template_total, 'ready', course_total = 1 and approved_course_total = 1 and module_total = 1 and approved_module_total = 1 and required_lesson_total = 1 and approved_required_lesson_total = 1 and required_material_total = 1 and governed_assessment_total = 1 and ready_governed_assessment_total = 1 and template_total = 1 and approved_template_total = 1);
end;
$readiness$;
revoke all on function public.niu_programme_bundle_readiness(uuid) from public, anon;
grant execute on function public.niu_programme_bundle_readiness(uuid) to authenticated;
