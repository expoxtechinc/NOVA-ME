-- Keep AI draft-package lesson creation inside the live lessons_kind_check contract.
-- Creates linked private records only after an authorised staff call.
create or replace function public.niu_create_ai_draft_package(p_job_id uuid, p_package jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $niu_ai_package$
declare
  actor uuid := auth.uid();
  job_record record;
  school_id uuid;
  department_id uuid;
  program_id uuid;
  course_id uuid;
  version_id uuid;
  module_id uuid;
  lesson_id uuid;
  bank_id uuid;
  assessment_id uuid;
  question_id uuid;
  course_item jsonb;
  module_item jsonb;
  lesson_item jsonb;
  question_item jsonb;
  assessment_item jsonb;
  material_item jsonb;
  course_position integer := 0;
  module_position integer;
  lesson_position integer;
  question_position integer;
  material_position integer;
  created_courses jsonb := '[]'::jsonb;
  created_lessons_json jsonb := '[]'::jsonb;
  created_modules integer := 0;
  created_lessons integer := 0;
  created_questions integer := 0;
  created_assessments integer := 0;
begin
  if actor is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required for AI draft package generation';
  end if;
  select * into job_record from public.ai_academic_builder_jobs where id = p_job_id and status in ('generation_review','ready_for_review') for update;
  if not found then raise exception 'AI Builder job must be in generation review before package generation'; end if;
  if exists (select 1 from public.ai_academic_builder_jobs where id = p_job_id and generated_record_ids <> '{}'::jsonb) then
    raise exception 'This AI Builder job already has a generated draft package';
  end if;
  if jsonb_typeof(p_package->'programme') <> 'object' or jsonb_array_length(coalesce(p_package->'courses','[]'::jsonb)) = 0 then
    raise exception 'Complete package requires a programme and at least one course';
  end if;

  insert into public.schools (code,name,description,status,created_by)
  values ('AI-' || upper(substr(md5(p_job_id::text),1,8)), left(coalesce(p_package->'school'->>'name','NIU Academic Development'),160), 'Private AI Builder draft school; administrator verification required.', 'draft', actor)
  returning id into school_id;

  insert into public.departments (school_id,code,name,description,status)
  values (school_id, 'AI-' || upper(substr(md5((p_job_id::text || '-dept')),1,8)), left(coalesce(p_package->'department'->>'name',job_record.topic || ' Academic Development'),160), 'Private AI Builder draft department; administrator verification required.', 'draft')
  returning id into department_id;

  insert into public.certificate_programs (department_id,code,name,description,objectives,learning_outcomes,duration_hours,difficulty,required_score,completion_requirements,certificate_template_key,status,created_by)
  values (department_id, 'AI-' || upper(substr(md5((p_job_id::text || '-program')),1,10)), left(p_package->'programme'->>'title',255), left(coalesce(p_package->'programme'->>'description','Draft certificate programme; administrator verification required.'),10000), coalesce(p_package->'programme'->'objectives','[]'::jsonb), coalesce(p_package->'programme'->'learningOutcomes','[]'::jsonb), greatest(0,coalesce((p_package->'programme'->>'learningHours')::integer,0)), case lower(coalesce(p_package->'programme'->>'difficulty','beginner')) when 'introductory' then 'beginner' else lower(coalesce(p_package->'programme'->>'difficulty','beginner')) end, 70, coalesce(p_package->'programme'->'completionRequirements','{}'::jsonb), p_package->'programme'->>'certificateTemplateKey', 'draft', actor)
  returning id into program_id;

  for course_item in select value from jsonb_array_elements(p_package->'courses') with ordinality as t(value, ord) order by ord loop
    insert into public.courses (author_id,slug,title,description,category,level,duration_minutes,price_cents,currency,learning_objectives,requirements,certificate_eligible,status,learning_outcomes,entry_requirements,certificate_template_key,publication_notes,governed_workflow)
    values (actor, 'ai-' || substr(md5(p_job_id::text || '-course-' || course_position::text),1,18), left(course_item->>'title',255), left(coalesce(course_item->>'description','Draft course; administrator verification required.'),10000), left(coalesce(p_package->'department'->>'name','NIU Academic Development'),120), case lower(coalesce(course_item->>'difficulty','beginner')) when 'introductory' then 'beginner' else lower(coalesce(course_item->>'difficulty','beginner')) end, greatest(0,coalesce((course_item->>'durationMinutes')::integer,0)), 0, 'usd', coalesce(course_item->'objectives','[]'::jsonb), coalesce(course_item->'requirements','[]'::jsonb), true, 'draft', coalesce(course_item->'learningOutcomes','[]'::jsonb), coalesce(course_item->'entryRequirements','[]'::jsonb), p_package->'programme'->>'certificateTemplateKey', 'AI Builder draft; verify all claims and relationships before approval.', true)
    returning id into course_id;
    insert into public.program_courses(program_id,course_id,position,is_required) values (program_id,course_id,course_position,true);
    insert into public.course_versions(course_id,version_number,status,change_summary,snapshot,created_by) values (course_id,1,'draft','AI Builder initial draft package',course_item,actor) returning id into version_id;
    created_courses := created_courses || jsonb_build_object('courseId',course_id,'versionId',version_id,'position',course_position);
    module_position := 0;
    for module_item in select value from jsonb_array_elements(coalesce(course_item->'modules','[]'::jsonb)) with ordinality as t(value, ord) order by ord loop
      insert into public.course_modules(course_id,title,description,position,status,learning_level,learning_objectives,estimated_minutes,support_guidance,governed_workflow)
      values (course_id,left(module_item->>'title',255),left(coalesce(module_item->>'description','Draft module; administrator verification required.'),10000),module_position,'draft',case lower(coalesce(module_item->>'difficulty','foundation')) when 'introductory' then 'foundation' when 'intermediate' then 'developing' else 'advanced' end,coalesce(module_item->'objectives','[]'::jsonb),greatest(0,coalesce((module_item->>'estimatedMinutes')::integer,0)),coalesce(module_item->>'supportGuidance','Administrator must add and verify learner support guidance.'),true)
      returning id into module_id;
      created_modules := created_modules + 1;
      lesson_position := 0;
      for lesson_item in select value from jsonb_array_elements(coalesce(module_item->'lessons','[]'::jsonb)) with ordinality as t(value, ord) order by ord loop
        insert into public.lessons(module_id,kind,title,description,position,rich_text,assessment,is_required,content_json,learning_objectives,estimated_minutes,points,status,governed_workflow)
        values (module_id,coalesce(lesson_item->>'kind','article'),left(lesson_item->>'title',255),left(coalesce(lesson_item->>'description','Draft lesson; administrator verification required.'),10000),lesson_position,lesson_item->>'draftText',lesson_item->'assessment',true,jsonb_build_object('activities',coalesce(lesson_item->'activities','[]'::jsonb),'accessibility',coalesce(lesson_item->'accessibility','[]'::jsonb),'videoScript',coalesce(lesson_item->>'videoScript','Missing: administrator must author a video script if video is required.'),'transcript',coalesce(lesson_item->>'transcript','Missing: administrator must author or verify a transcript.'),'diagrams',coalesce(lesson_item->'diagrams','[]'::jsonb),'references',coalesce(lesson_item->'references','[]'::jsonb),'assignment',coalesce(lesson_item->'assignment','Missing: administrator must define an assignment if required.'),'rubric',coalesce(lesson_item->'rubric','Missing: administrator must define and approve a rubric if required.'),'verificationRequired',true),coalesce(lesson_item->'objectives','[]'::jsonb),greatest(0,coalesce((lesson_item->>'estimatedMinutes')::integer,0)),greatest(0,coalesce((lesson_item->>'points')::numeric,0)),'draft',true)
        returning id into lesson_id;
        created_lessons_json := created_lessons_json || jsonb_build_object('lessonId',lesson_id,'moduleId',module_id,'courseId',course_id,'title',lesson_item->>'title','position',lesson_position);
        created_lessons := created_lessons + 1;
        material_position := 0;
      for material_item in select value from jsonb_array_elements(coalesce(lesson_item->'materials','[]'::jsonb)) loop
          insert into public.content_library_items(title,category,file_name,content_type,storage_path,description,created_by)
          values (left(material_item->>'title',180),'study_guide',left(material_item->>'fileName',180),'text/markdown',material_item->>'storagePath',left(coalesce(material_item->>'description','AI Builder draft material; administrator verification required.'),10000),actor)
          returning id into question_id;
          insert into public.lesson_content_items(lesson_id,content_item_id,position,is_required) values (lesson_id,question_id,material_position,true);
          material_position := material_position + 1;
        end loop;
        lesson_position := lesson_position + 1;
      end loop;
      for assessment_item in select value from jsonb_array_elements(coalesce(course_item->'assessments','[]'::jsonb)) loop
        insert into public.assessments(course_id,module_id,title,assessment_type,instructions,passing_score,attempt_limit,time_limit_minutes,randomize_questions,randomize_answers,weight,status,created_by)
        values (course_id,module_id,left(assessment_item->>'title',255),case lower(coalesce(assessment_item->>'type','module_test')) when 'final_exam' then 'exam' when 'knowledge_check' then 'knowledge_check' else 'module_test' end,assessment_item->>'instructions',greatest(0,least(100,coalesce((assessment_item->>'passingScore')::numeric,70))),greatest(1,coalesce((assessment_item->>'attemptLimit')::integer,2)),null,true,true,0,'draft',actor)
        returning id into assessment_id;
        created_assessments := created_assessments + 1;
        question_position := 0;
        insert into public.question_banks(department_id,title,description,status,created_by) values (department_id,left(coalesce(assessment_item->>'questionBankTitle',course_item->>'title' || ' Question Bank'),255),'AI Builder draft question bank; all questions require review and approval.','draft',actor) returning id into bank_id;
        for question_item in select value from jsonb_array_elements(coalesce(assessment_item->'questions','[]'::jsonb)) loop
          insert into public.questions(question_bank_id,question_type,prompt,choices,answer_key,explanation,difficulty,category,points,requires_manual_grading,learning_objective)
          values (bank_id,'multiple_choice',left(question_item->>'prompt',20000),coalesce(question_item->'choices','[]'::jsonb),coalesce(question_item->'answerKey','{}'::jsonb),question_item->>'explanation',case lower(coalesce(question_item->>'difficulty','intermediate')) when 'introductory' then 'beginner' else lower(coalesce(question_item->>'difficulty','intermediate')) end,question_item->>'topic',greatest(0,(question_item->>'points')::numeric),false,question_item->>'objective') returning id into question_id;
          insert into public.assessment_questions(assessment_id,question_id,position,points_override) values (assessment_id,question_id,question_position,(question_item->>'points')::numeric);
          created_questions := created_questions + 1;
          question_position := question_position + 1;
        end loop;
      end loop;
    end loop;
    course_position := course_position + 1;
  end loop;
  update public.ai_academic_builder_jobs set status='ready_for_review',generated_record_ids=jsonb_build_object('schoolId',school_id,'departmentId',department_id,'programId',program_id,'courses',created_courses,'lessons',created_lessons_json,'counts',jsonb_build_object('modules',created_modules,'lessons',created_lessons,'questions',created_questions,'assessments',created_assessments)) where id=p_job_id;
  return jsonb_build_object('schoolId',school_id,'departmentId',department_id,'programId',program_id,'courses',created_courses,'lessons',created_lessons_json,'counts',jsonb_build_object('modules',created_modules,'lessons',created_lessons,'questions',created_questions,'assessments',created_assessments));
end;
$niu_ai_package$;

revoke all on function public.niu_create_ai_draft_package(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.niu_create_ai_draft_package(uuid,jsonb) to authenticated;
