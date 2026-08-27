-- Creates NIU's first owner-approved programme structure as unpublished draft records only.
create or replace function public.niu_initialize_digital_starter_programme()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_school_id uuid;
declare v_department_id uuid;
declare v_program_id uuid;
declare v_course_id uuid;
declare created_school boolean := false;
declare created_department boolean := false;
declare created_program boolean := false;
declare created_course boolean := false;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin' and account_status = 'active') then raise exception 'Active Super Administrator authorization is required'; end if;

  select id into v_school_id from public.schools where code = 'NIU-DIGITAL' limit 1;
  if v_school_id is null then
    insert into public.schools (code, name, description, status, created_by)
    values ('NIU-DIGITAL', 'School of Digital Learning and Enterprise', 'NIU’s certificate-only school for inclusive digital skills, entrepreneurship, and remote-work learning. It does not provide degrees, professional licensure, accreditation, or employment guarantees.', 'draft', auth.uid())
    returning id into v_school_id;
    created_school := true;
  end if;

  select id into v_department_id from public.departments where code = 'DIGI-ENT' limit 1;
  if v_department_id is null then
    insert into public.departments (school_id, code, name, description, status)
    values (v_school_id, 'DIGI-ENT', 'Department of Digital Skills and Enterprise', 'A draft academic department supporting structured certificate learning in digital practice, entrepreneurship, and responsible remote work.', 'draft')
    returning id into v_department_id;
    created_department := true;
  end if;

  select id into v_program_id from public.certificate_programs where code = 'DSERW-CERT' limit 1;
  if v_program_id is null then
    insert into public.certificate_programs (department_id, code, name, award_type, description, objectives, learning_outcomes, duration_hours, difficulty, completion_requirements, certificate_template_key, status, created_by)
    values (v_department_id, 'DSERW-CERT', 'Certificate in Digital Skills, Entrepreneurship, and Remote Work', 'certificate', 'A certificate-only online programme supporting inclusive digital communication, responsible remote-work habits, opportunity recognition, and early-stage project planning. It does not grant a degree, professional licence, accreditation, employment guarantee, or recognition by an external body.', '["Build practical, accessible digital communication and collaboration habits.","Use privacy, security, and information-evaluation principles in online work.","Recognise opportunities and develop ideas that create social, cultural, or financial value.","Plan and communicate a small digital or remote-work project responsibly."]'::jsonb, '["Use core digital tools and online information responsibly.","Prepare an accessible remote-work collaboration plan.","Develop an evidence-based opportunity statement and simple action plan.","Reflect on ethics, inclusion, and data protection in a digital-work context."]'::jsonb, 36, 'beginner', '{"entry_requirements":["Access to an email account and web browser.","A device appropriate for online study.","Commitment to complete independent learning activities."],"completion_rules":["Complete every required module and protected learning activity.","Meet the approved assessment and participation requirements.","Submit a final applied project or portfolio when the programme team provides one."]}'::jsonb, 'NIU-DIGITAL-STARTER-v1', 'draft', auth.uid())
    returning id into v_program_id;
    created_program := true;
  end if;

  select id into v_course_id from public.courses where slug = 'digital-foundations-enterprise-remote-work' limit 1;
  if v_course_id is null then
    insert into public.courses (author_id, slug, title, description, category, level, duration_minutes, learning_objectives, requirements, certificate_eligible, status, learning_outcomes, entry_requirements, certificate_template_key, publication_notes)
    values (auth.uid(), 'digital-foundations-enterprise-remote-work', 'Digital Foundations for Enterprise and Remote Work', 'An unpublished certificate-course draft that introduces responsible digital practice, inclusive collaboration, basic opportunity thinking, and remote-work planning. Academic staff must add and review the final modules, lessons, materials, assessments, and learner-support guidance before release.', 'Digital skills and enterprise', 'beginner', 2160, '["Use common digital tools for organized individual and team work.","Recognise privacy, security, and accessibility considerations in remote collaboration.","Develop and evaluate a simple digital opportunity idea.","Plan a small remote-work deliverable with responsible communication practices."]'::jsonb, '["No prior professional qualification is required.","Learners need a web-connected device and basic email access."]'::jsonb, true, 'draft', '["Demonstrate responsible digital communication and collaboration.","Describe core privacy and information-evaluation practices.","Prepare a simple opportunity and action plan."]'::jsonb, '["Web browser access.","Ability to use an email account."]'::jsonb, 'NIU-DIGITAL-STARTER-v1', 'Draft only: add approved modules, protected learning materials, assessments, accessibility supports, and reviewer approval before programme publication.')
    returning id into v_course_id;
    insert into public.course_versions (course_id, version_number, status, change_summary, snapshot, created_by)
    values (v_course_id, 1, 'draft', 'Initial NIU digital starter course draft', jsonb_build_object('title', 'Digital Foundations for Enterprise and Remote Work', 'scope', 'certificate_only', 'publication_state', 'draft'), auth.uid());
    created_course := true;
  end if;

  insert into public.program_courses (program_id, course_id, position, is_required)
  values (v_program_id, v_course_id, 0, true)
  on conflict on constraint program_courses_pkey do nothing;

  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), 'digital_starter_programme_initialized', 'certificate_program', v_program_id, jsonb_build_object('school_id', v_school_id, 'department_id', v_department_id, 'course_id', v_course_id, 'created_school', created_school, 'created_department', created_department, 'created_program', created_program, 'created_course', created_course, 'status', 'draft'));
  return jsonb_build_object('school_id', v_school_id, 'department_id', v_department_id, 'program_id', v_program_id, 'course_id', v_course_id, 'status', 'draft', 'created_school', created_school, 'created_department', created_department, 'created_program', created_program, 'created_course', created_course);
end;
$$;

revoke all on function public.niu_initialize_digital_starter_programme() from public, anon;
grant execute on function public.niu_initialize_digital_starter_programme() to authenticated;
