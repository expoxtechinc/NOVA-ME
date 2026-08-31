-- Extend the existing governed readiness source with content-quality requirements.
-- No academic records are created, updated, deleted, or re-seeded.

create or replace function public.niu_programme_bundle_readiness(target_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  program_record public.certificate_programs;
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
  missing jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then raise exception 'Academic staff authorization is required'; end if;
  select * into program_record from public.certificate_programs where id = target_program_id;
  if not found then raise exception 'Certificate programme not found'; end if;

  select count(*) filter (where pc.is_required), count(*) filter (where pc.is_required and c.status in ('approved','published')) into course_total, approved_course_total
    from public.program_courses pc join public.courses c on c.id = pc.course_id where pc.program_id = target_program_id;
  select count(*), count(*) filter (where m.status in ('approved','published')) into module_total, approved_module_total
    from public.program_modules pm join public.course_modules m on m.id = pm.module_id where pm.program_id = target_program_id and pm.is_required;
  select count(*), count(*) filter (where l.status in ('approved','published')) into required_lesson_total, approved_required_lesson_total
    from public.program_lessons pl join public.lessons l on l.id = pl.lesson_id where pl.program_id = target_program_id and pl.is_required and l.is_required;
  select count(distinct l.id) into required_material_total
    from public.program_lessons pl join public.lessons l on l.id = pl.lesson_id
    join public.course_modules m on m.id = l.module_id join public.program_courses pc on pc.course_id = m.course_id and pc.program_id = pl.program_id
    join public.lesson_content_items lci on lci.lesson_id = l.id and lci.is_required
    join public.content_library_items cli on cli.id = lci.content_item_id
   where pl.program_id = target_program_id and pl.is_required and l.is_required
     and cli.status in ('approved','published')
     and (char_length(trim(coalesce(cli.inline_content,''))) >= 40 or char_length(trim(coalesce(cli.storage_path,''))) > 0);
  select count(*), count(*) filter (where a.status in ('approved','published') and a.passing_score > 0 and a.passing_score <= 100 and a.attempt_limit > 0 and a.time_limit_minutes > 0 and jsonb_typeof(a.required_completion_rules) = 'object' and exists (select 1 from jsonb_each(a.required_completion_rules) as rule(key,value)) and exists (select 1 from public.assessment_questions aq join public.questions q on q.id=aq.question_id where aq.assessment_id=a.id and q.approval_status in ('approved','published'))) into governed_assessment_total, ready_governed_assessment_total
    from public.program_courses pc join public.assessments a on a.course_id=pc.course_id where pc.program_id=target_program_id and pc.is_required and a.governed_workflow;
  select count(*), count(*) filter (where t.status in ('approved','published')) into template_total, approved_template_total
    from public.certificate_templates t where t.template_key=program_record.certificate_template_key and t.governed_workflow and jsonb_typeof(t.configuration)='object' and exists (select 1 from jsonb_each(t.configuration) as setting(key,value));

  if program_record.status not in ('approved','published') then missing := missing || jsonb_build_array(jsonb_build_object('key','programme','complete',false,'missing',jsonb_build_array('Programme must be approved before publication'))); end if;
  if course_total <> 1 or approved_course_total <> 1 then missing := missing || jsonb_build_array(jsonb_build_object('key','courses','complete',false,'missing',jsonb_build_array('Exactly one required approved course is needed'))); end if;
  if module_total <> 1 or approved_module_total <> 1 then missing := missing || jsonb_build_array(jsonb_build_object('key','modules','complete',false,'missing',jsonb_build_array('Exactly one required approved module relationship is needed'))); end if;
  if required_lesson_total <> 1 or approved_required_lesson_total <> 1 then missing := missing || jsonb_build_array(jsonb_build_object('key','lessons','complete',false,'missing',jsonb_build_array('Exactly one required approved lesson relationship is needed'))); end if;
  if required_material_total <> 1 then missing := missing || jsonb_build_array(jsonb_build_object('key','learning_content','complete',false,'missing',jsonb_build_array('Every required lesson needs approved notes or a protected resource with a valid storage reference'))); end if;
  if governed_assessment_total <> 1 or ready_governed_assessment_total <> 1 then missing := missing || jsonb_build_array(jsonb_build_object('key','assessment','complete',false,'missing',jsonb_build_array('Exactly one governed assessment with valid rules and approved questions is needed'))); end if;
  if template_total <> 1 or approved_template_total <> 1 then missing := missing || jsonb_build_array(jsonb_build_object('key','certificate','complete',false,'missing',jsonb_build_array('Exactly one matching approved governed certificate template is needed'))); end if;

  return jsonb_build_object('program_id',program_record.id,'program_status',program_record.status,'courses',course_total,'approved_courses',approved_course_total,'modules',module_total,'approved_modules',approved_module_total,'required_lessons',required_lesson_total,'approved_required_lessons',approved_required_lesson_total,'required_lessons_with_material',required_material_total,'governed_assessments',governed_assessment_total,'ready_governed_assessments',ready_governed_assessment_total,'certificate_templates',template_total,'approved_certificate_templates',approved_template_total,'requirements',missing,'missing_requirements',missing,'completed',7-jsonb_array_length(missing),'total',7,'percentage',greatest(0,round((7-jsonb_array_length(missing))*100.0/7)),'ready',jsonb_array_length(missing)=0);
end;
$$;

create or replace function public.niu_get_programme_readiness(programme_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$ select public.niu_programme_bundle_readiness(programme_id); $$;

revoke all on function public.niu_programme_bundle_readiness(uuid) from public, anon;
grant execute on function public.niu_programme_bundle_readiness(uuid) to authenticated;
revoke all on function public.niu_get_programme_readiness(uuid) from public, anon;
grant execute on function public.niu_get_programme_readiness(uuid) to authenticated;
