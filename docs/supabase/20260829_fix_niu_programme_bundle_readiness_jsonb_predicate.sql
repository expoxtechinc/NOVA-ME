-- Repair PostgreSQL-compatible JSONB validation in the governed programme-bundle readiness gate.
-- This is an additive function replacement only; no academic rows are created, deleted, or modified.
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

  select * into program_record
    from public.certificate_programs
   where id = target_program_id;

  if not found then
    raise exception 'Certificate programme not found';
  end if;

  select count(*), count(*) filter (where c.status in ('approved', 'published'))
    into course_total, approved_course_total
    from public.program_courses pc
    join public.courses c on c.id = pc.course_id
   where pc.program_id = target_program_id;

  select count(*), count(*) filter (where m.status in ('approved', 'published'))
    into module_total, approved_module_total
    from public.program_courses pc
    join public.course_modules m on m.course_id = pc.course_id
   where pc.program_id = target_program_id;

  select count(*), count(*) filter (where l.status in ('approved', 'published'))
    into required_lesson_total, approved_required_lesson_total
    from public.program_courses pc
    join public.course_modules m on m.course_id = pc.course_id
    join public.lessons l on l.module_id = m.id
   where pc.program_id = target_program_id
     and l.is_required;

  select count(distinct l.id)
    into required_material_total
    from public.program_courses pc
    join public.course_modules m on m.course_id = pc.course_id
    join public.lessons l on l.module_id = m.id
    left join public.lesson_content_items li on li.lesson_id = l.id
   where pc.program_id = target_program_id
     and l.is_required
     and li.lesson_id is not null;

  select count(*)
    into governed_assessment_total
    from public.program_courses pc
    join public.assessments a on a.course_id = pc.course_id
   where pc.program_id = target_program_id
     and a.governed_workflow;

  select count(*)
    into ready_governed_assessment_total
    from public.program_courses pc
    join public.assessments a on a.course_id = pc.course_id
   where pc.program_id = target_program_id
     and a.governed_workflow
     and a.status in ('approved', 'published')
     and a.passing_score > 0
     and a.passing_score <= 100
     and a.time_limit_minutes is not null
     and a.time_limit_minutes > 0
     and a.attempt_limit is not null
     and a.attempt_limit > 0
     and jsonb_typeof(coalesce(a.required_completion_rules, '{}'::jsonb)) = 'object'
     and exists (
       select 1
         from jsonb_each(coalesce(a.required_completion_rules, '{}'::jsonb))
        limit 1
     )
     and exists (
       select 1
         from public.assessment_questions aq
         join public.questions q on q.id = aq.question_id
        where aq.assessment_id = a.id
          and q.approval_status in ('approved', 'published')
     )
     and not exists (
       select 1
         from public.assessment_questions aq
         join public.questions q on q.id = aq.question_id
        where aq.assessment_id = a.id
          and q.approval_status not in ('approved', 'published')
     );

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
    'ready', course_total > 0
      and course_total = approved_course_total
      and module_total > 0
      and module_total = approved_module_total
      and required_lesson_total > 0
      and required_lesson_total = approved_required_lesson_total
      and required_lesson_total = required_material_total
      and (governed_assessment_total = 0 or governed_assessment_total = ready_governed_assessment_total)
  );
end;
$function$;

revoke all on function public.niu_programme_bundle_readiness(uuid) from public, anon;
grant execute on function public.niu_programme_bundle_readiness(uuid) to authenticated;
