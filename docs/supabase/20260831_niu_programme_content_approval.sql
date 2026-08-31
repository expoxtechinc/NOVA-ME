-- Governed approval actions for programme content and short-certificate readiness.
-- Updates only the requested course, module, or lesson row and records an audit event.
create or replace function public.niu_approve_academic_record(target_type text, target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  before_record jsonb;
  after_record jsonb;
  resource_type text;
begin
  if actor is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required';
  end if;
  if target_type not in ('course', 'module', 'lesson') then
    raise exception 'Only course, module, and lesson records can be approved here';
  end if;

  if target_type = 'course' then
    select to_jsonb(c), 'course' into before_record, resource_type from public.courses c where c.id = target_id;
    if before_record is null then raise exception 'Course not found'; end if;
    update public.courses set status = 'approved', updated_at = now() where id = target_id and status in ('draft', 'review') returning to_jsonb(courses) into after_record;
  elsif target_type = 'module' then
    select to_jsonb(m), 'module' into before_record, resource_type from public.course_modules m where m.id = target_id;
    if before_record is null then raise exception 'Module not found'; end if;
    update public.course_modules set status = 'approved' where id = target_id and status in ('draft', 'review') returning to_jsonb(course_modules) into after_record;
  else
    select to_jsonb(l), 'lesson' into before_record, resource_type from public.lessons l where l.id = target_id;
    if before_record is null then raise exception 'Lesson not found'; end if;
    update public.lessons set status = 'approved' where id = target_id and status in ('draft', 'review') returning to_jsonb(lessons) into after_record;
  end if;

  if after_record is null then
    raise exception 'Only draft or review records can be approved';
  end if;

  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (actor, 'UPDATE', resource_type, target_id, jsonb_build_object('event', 'academic_record_approved', 'before', before_record, 'after', after_record));

  return jsonb_build_object('record_type', resource_type, 'record_id', target_id, 'status', 'approved', 'audit_recorded', true);
end;
$function$;

revoke all on function public.niu_approve_academic_record(text, uuid) from public, anon;
grant execute on function public.niu_approve_academic_record(text, uuid) to authenticated;

create or replace function public.niu_programme_bundle_readiness(target_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
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
  program_record public.certificate_programs;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required';
  end if;
  select * into program_record from public.certificate_programs where id = target_program_id;
  if not found then raise exception 'Certificate programme not found'; end if;

  select count(*) filter (where pc.is_required), count(*) filter (where pc.is_required and c.status in ('approved', 'published'))
    into course_total, approved_course_total
    from public.program_courses pc join public.courses c on c.id = pc.course_id
   where pc.program_id = target_program_id;

  select count(*), count(*) filter (where m.status in ('approved', 'published'))
    into module_total, approved_module_total
    from public.program_courses pc join public.course_modules m on m.course_id = pc.course_id
   where pc.program_id = target_program_id and pc.is_required;

  select count(*), count(*) filter (where l.status in ('approved', 'published'))
    into required_lesson_total, approved_required_lesson_total
    from public.program_courses pc join public.course_modules m on m.course_id = pc.course_id join public.lessons l on l.module_id = m.id
   where pc.program_id = target_program_id and pc.is_required and l.is_required;

  select count(distinct l.id) into required_material_total
    from public.program_courses pc join public.course_modules m on m.course_id = pc.course_id join public.lessons l on l.module_id = m.id
    join public.lesson_content_items li on li.lesson_id = l.id
   where pc.program_id = target_program_id and pc.is_required and l.is_required;

  select count(*) into governed_assessment_total
    from public.program_courses pc join public.assessments a on a.course_id = pc.course_id
   where pc.program_id = target_program_id and pc.is_required and a.governed_workflow;

  select count(*) into ready_governed_assessment_total
    from public.program_courses pc join public.assessments a on a.course_id = pc.course_id
   where pc.program_id = target_program_id and pc.is_required and a.governed_workflow
     and a.status in ('approved', 'published') and a.passing_score > 0 and a.passing_score <= 100
     and a.time_limit_minutes is not null and a.time_limit_minutes > 0
     and a.attempt_limit is not null and a.attempt_limit > 0
     and jsonb_typeof(coalesce(a.required_completion_rules, '{}'::jsonb)) = 'object'
     and exists (select 1 from jsonb_each(coalesce(a.required_completion_rules, '{}'::jsonb)) limit 1)
     and exists (select 1 from public.assessment_questions aq join public.questions q on q.id = aq.question_id where aq.assessment_id = a.id and q.approval_status in ('approved', 'published'))
     and not exists (select 1 from public.assessment_questions aq join public.questions q on q.id = aq.question_id where aq.assessment_id = a.id and q.approval_status not in ('approved', 'published'));

  return jsonb_build_object(
    'program_id', program_record.id,
    'program_status', program_record.status,
    'courses', course_total,
    'approved_courses', approved_course_total,
    'modules', module_total,
    'approved_modules', approved_module_total,
    'required_lessons', required_lesson_total,
    'approved_required_lessons', approved_required_lesson_total,
    'required_lessons_with_material', required_material_total,
    'governed_assessments', governed_assessment_total,
    'ready_governed_assessments', ready_governed_assessment_total,
    'ready', course_total = 1 and approved_course_total = 1
      and module_total = 1 and approved_module_total = 1
      and required_lesson_total = 1 and approved_required_lesson_total = 1
      and required_material_total = 1
      and governed_assessment_total = 1 and ready_governed_assessment_total = 1
      and program_record.certificate_template_key is not null and length(trim(program_record.certificate_template_key)) > 0
  );
end;
$function$;

revoke all on function public.niu_programme_bundle_readiness(uuid) from public, anon;
grant execute on function public.niu_programme_bundle_readiness(uuid) to authenticated;
