-- NIU Unified Academic Production Studio readiness and publication.
-- Additive and idempotent: existing records, authentication, RLS, certificates,
-- and public pages are preserved. The database remains authoritative.

alter table public.content_library_items add column if not exists updated_at timestamptz not null default now();

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
  current_status text;
begin
  if actor is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required';
  end if;
  if target_type not in ('programme','course','module','lesson','content_item','assessment','certificate_template','question') then
    raise exception 'Unsupported academic record type';
  end if;
  if target_status not in ('review','approved') then
    raise exception 'Only Review and Approved transitions are available';
  end if;

  if target_type = 'programme' then
    select to_jsonb(p), p.status into before_record, current_status from public.certificate_programs p where p.id = target_id;
    if before_record is null then raise exception 'Certificate programme not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft programme must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review programmes can transition'; end if;
    update public.certificate_programs set status = target_status, updated_at = now() where id = target_id returning to_jsonb(certificate_programs) into after_record;
  elsif target_type = 'course' then
    select to_jsonb(c), c.status::text into before_record, current_status from public.courses c where c.id = target_id;
    if before_record is null then raise exception 'Course not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.courses set status = target_status::public.course_status, updated_at = now() where id = target_id returning to_jsonb(courses) into after_record;
  elsif target_type = 'module' then
    select to_jsonb(m), m.status into before_record, current_status from public.course_modules m where m.id = target_id;
    if before_record is null then raise exception 'Module not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.course_modules set status = target_status where id = target_id returning to_jsonb(course_modules) into after_record;
  elsif target_type = 'lesson' then
    select to_jsonb(l), l.status into before_record, current_status from public.lessons l where l.id = target_id;
    if before_record is null then raise exception 'Lesson not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.lessons set status = target_status where id = target_id returning to_jsonb(lessons) into after_record;
  elsif target_type = 'content_item' then
    select to_jsonb(c), coalesce(c.status, 'draft') into before_record, current_status from public.content_library_items c where c.id = target_id;
    if before_record is null then raise exception 'Content item not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.content_library_items set status = target_status, updated_at = now() where id = target_id returning to_jsonb(content_library_items) into after_record;
  elsif target_type = 'assessment' then
    select to_jsonb(a), a.status into before_record, current_status from public.assessments a where a.id = target_id;
    if before_record is null then raise exception 'Assessment not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.assessments set status = target_status, updated_at = now() where id = target_id returning to_jsonb(assessments) into after_record;
  elsif target_type = 'certificate_template' then
    select to_jsonb(t), t.status into before_record, current_status from public.certificate_templates t where t.id = target_id;
    if before_record is null then raise exception 'Certificate template not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.certificate_templates set status = target_status, updated_at = now() where id = target_id returning to_jsonb(certificate_templates) into after_record;
  else
    select to_jsonb(q), q.approval_status into before_record, current_status from public.questions q where q.id = target_id;
    if before_record is null then raise exception 'Question not found'; end if;
    if target_status = 'approved' and current_status <> 'review' then raise exception 'Draft question must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review questions can transition'; end if;
    update public.questions set approval_status = target_status, approved_by = case when target_status = 'approved' then actor else null end, approved_at = case when target_status = 'approved' then now() else null end, updated_at = now() where id = target_id returning to_jsonb(questions) into after_record;
  end if;

  insert into public.audit_events(actor_id, action, subject_type, subject_id, metadata)
  values (actor, 'UPDATE', target_type, target_id, jsonb_build_object('event','academic_record_status_changed','from',current_status,'to',target_status,'before',before_record,'after',after_record));
  return jsonb_build_object('record_type',target_type,'record_id',target_id,'status',target_status,'audit_recorded',true);
end;
$function$;

revoke all on function public.niu_transition_academic_record(text, uuid, text) from public, anon;
grant execute on function public.niu_transition_academic_record(text, uuid, text) to authenticated;

create or replace function public.niu_programme_bundle_readiness(target_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $readiness$
declare
  program_record public.certificate_programs;
  course_total integer := 0;
  approved_course_total integer := 0;
  module_total integer := 0;
  approved_module_total integer := 0;
  required_lesson_total integer := 0;
  approved_required_lesson_total integer := 0;
  required_material_total integer := 0;
  governed_assessment_total integer := 0;
  ready_governed_assessment_total integer := 0;
  template_total integer := 0;
  approved_template_total integer := 0;
  programme_ready boolean;
  courses_ready boolean;
  modules_ready boolean;
  lessons_ready boolean;
  content_ready boolean;
  assessments_ready boolean;
  certificate_ready boolean;
  missing jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required';
  end if;
  select * into program_record from public.certificate_programs where id = target_program_id;
  if not found then raise exception 'Certificate programme not found'; end if;

  select count(*) filter (where pc.is_required), count(*) filter (where pc.is_required and c.status in ('approved','published'))
    into course_total, approved_course_total
    from public.program_courses pc join public.courses c on c.id = pc.course_id
   where pc.program_id = target_program_id;

  select count(*) filter (where pm.is_required), count(*) filter (where pm.is_required and m.status in ('approved','published'))
    into module_total, approved_module_total
    from public.program_modules pm join public.course_modules m on m.id = pm.module_id
   where pm.program_id = target_program_id;

  select count(*) filter (where pl.is_required and l.is_required), count(*) filter (where pl.is_required and l.is_required and l.status in ('approved','published'))
    into required_lesson_total, approved_required_lesson_total
    from public.program_lessons pl join public.lessons l on l.id = pl.lesson_id and l.module_id = pl.module_id
   where pl.program_id = target_program_id;

  select count(distinct l.id) into required_material_total
    from public.program_lessons pl
    join public.lessons l on l.id = pl.lesson_id and l.module_id = pl.module_id
    join public.lesson_content_items lci on lci.lesson_id = l.id and lci.is_required
    join public.content_library_items cli on cli.id = lci.content_item_id
   where pl.program_id = target_program_id and pl.is_required and l.is_required
     and coalesce(cli.status, 'draft') in ('approved','published')
     and (char_length(trim(coalesce(cli.inline_content,''))) >= 40 or char_length(trim(coalesce(cli.storage_path,''))) > 0);

  select count(*), count(*) filter (where a.status in ('approved','published')
      and a.passing_score > 0 and a.passing_score <= 100
      and a.attempt_limit is not null and a.attempt_limit > 0
      and a.time_limit_minutes is not null and a.time_limit_minutes > 0
      and jsonb_typeof(coalesce(a.required_completion_rules, '{}'::jsonb)) = 'object'
      and exists (select 1 from jsonb_each(coalesce(a.required_completion_rules, '{}'::jsonb)) limit 1)
      and exists (select 1 from public.assessment_questions aq join public.questions q on q.id = aq.question_id where aq.assessment_id = a.id and q.approval_status in ('approved','published'))
      and not exists (select 1 from public.assessment_questions aq join public.questions q on q.id = aq.question_id where aq.assessment_id = a.id and q.approval_status not in ('approved','published')))
    into governed_assessment_total, ready_governed_assessment_total
    from public.program_courses pc join public.assessments a on a.course_id = pc.course_id
   where pc.program_id = target_program_id and pc.is_required and a.governed_workflow;

  select count(*), count(*) filter (where t.status in ('approved','published')) into template_total, approved_template_total
    from public.certificate_templates t
   where t.template_key = program_record.certificate_template_key and t.governed_workflow
     and jsonb_typeof(coalesce(t.configuration, '{}'::jsonb)) = 'object'
     and exists (select 1 from jsonb_each(coalesce(t.configuration, '{}'::jsonb)) as setting(key,value));

  programme_ready := program_record.status in ('approved','published') and program_record.award_type = 'certificate';
  courses_ready := course_total > 0 and course_total = approved_course_total;
  modules_ready := module_total > 0 and module_total = approved_module_total;
  lessons_ready := required_lesson_total > 0 and required_lesson_total = approved_required_lesson_total;
  content_ready := lessons_ready and required_lesson_total = required_material_total;
  assessments_ready := governed_assessment_total > 0 and governed_assessment_total = ready_governed_assessment_total;
  certificate_ready := template_total = 1 and approved_template_total = 1;

  if not programme_ready then missing := missing || jsonb_build_array(jsonb_build_object('key','programme','complete',false,'missing',jsonb_build_array('Certificate programme must be approved before publication'))); end if;
  if not courses_ready then missing := missing || jsonb_build_array(jsonb_build_object('key','courses','complete',false,'missing',jsonb_build_array('At least one required course must be approved'))); end if;
  if not modules_ready then missing := missing || jsonb_build_array(jsonb_build_object('key','modules','complete',false,'missing',jsonb_build_array('Every required module relationship must be approved'))); end if;
  if not lessons_ready then missing := missing || jsonb_build_array(jsonb_build_object('key','lessons','complete',false,'missing',jsonb_build_array('Every required lesson must be approved'))); end if;
  if not content_ready then missing := missing || jsonb_build_array(jsonb_build_object('key','learning_content','complete',false,'missing',jsonb_build_array('Every required lesson needs approved inline learning content or a protected resource'))); end if;
  if not assessments_ready then missing := missing || jsonb_build_array(jsonb_build_object('key','assessment','complete',false,'missing',jsonb_build_array('At least one required governed assessment with approved questions and saved rules is needed'))); end if;
  if not certificate_ready then missing := missing || jsonb_build_array(jsonb_build_object('key','certificate','complete',false,'missing',jsonb_build_array('Exactly one matching approved governed certificate template is needed'))); end if;

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
    'certificate_templates', template_total,
    'approved_certificate_templates', approved_template_total,
    'requirements', missing,
    'missing_requirements', missing,
    'completed', 7 - jsonb_array_length(missing),
    'total', 7,
    'percentage', greatest(0, round((7 - jsonb_array_length(missing)) * 100.0 / 7)),
    'ready', jsonb_array_length(missing) = 0
  );
end;
$readiness$;

create or replace function public.niu_get_programme_readiness(programme_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$ select public.niu_programme_bundle_readiness(programme_id); $$;

create or replace function public.niu_publish_programme_bundle(target_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $publish$
declare
  readiness jsonb;
begin
  if auth.uid() is null or not public.niu_is_administrator() then
    raise exception 'Administrator authorization is required';
  end if;
  select public.niu_programme_bundle_readiness(target_program_id) into readiness;
  if not coalesce((readiness ->> 'ready')::boolean, false) then
    raise exception 'This programme package is not ready. Complete and approve every required programme, course, module, lesson, content, assessment, and certificate record first.';
  end if;
  update public.certificate_programs set status = 'published', published_at = now(), updated_at = now() where id = target_program_id and award_type = 'certificate';
  if not found then raise exception 'Only certificate programmes may be published'; end if;
  update public.courses set status = 'published', published_at = coalesce(published_at, now()), updated_at = now() where id in (select course_id from public.program_courses where program_id = target_program_id) and status = 'approved';
  update public.course_modules set status = 'published' where id in (select module_id from public.program_modules where program_id = target_program_id) and status = 'approved';
  update public.lessons set status = 'published' where id in (select lesson_id from public.program_lessons where program_id = target_program_id) and status = 'approved';
  update public.content_library_items set status = 'published', updated_at = now() where id in (select lci.content_item_id from public.lesson_content_items lci join public.program_lessons pl on pl.lesson_id = lci.lesson_id where pl.program_id = target_program_id) and coalesce(status, 'draft') = 'approved';
  update public.assessments set status = 'published', updated_at = now() where id in (select a.id from public.assessments a join public.program_courses pc on pc.course_id = a.course_id where pc.program_id = target_program_id) and status = 'approved';
  update public.certificate_templates set status = 'published', updated_at = now() where template_key = (select certificate_template_key from public.certificate_programs where id = target_program_id) and status = 'approved';
  insert into public.audit_events(actor_id, action, subject_type, subject_id, metadata) values (auth.uid(), 'programme_bundle_published', 'certificate_program', target_program_id, readiness);
  return readiness || jsonb_build_object('published', true);
end;
$publish$;

revoke all on function public.niu_programme_bundle_readiness(uuid) from public, anon;
revoke all on function public.niu_get_programme_readiness(uuid) from public, anon;
revoke all on function public.niu_publish_programme_bundle(uuid) from public, anon;
grant execute on function public.niu_programme_bundle_readiness(uuid) to authenticated;
grant execute on function public.niu_get_programme_readiness(uuid) to authenticated;
grant execute on function public.niu_publish_programme_bundle(uuid) to authenticated;
