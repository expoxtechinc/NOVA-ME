-- Initializes the recommended outline for NIU's first draft course; it creates no learner-facing material.
create or replace function public.niu_initialize_digital_starter_modules()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_course_id uuid;
declare v_existing_count integer;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin' and account_status = 'active') then raise exception 'Active Super Administrator authorization is required'; end if;
  select id into v_course_id from public.courses where slug = 'digital-foundations-enterprise-remote-work' limit 1;
  if v_course_id is null then raise exception 'Create the NIU starter programme structure before initializing its module outline'; end if;
  select count(*) into v_existing_count from public.course_modules where course_id = v_course_id;
  if v_existing_count > 0 then return jsonb_build_object('course_id', v_course_id, 'created', false, 'module_count', v_existing_count, 'reason', 'Existing modules were retained'); end if;

  insert into public.course_modules (course_id, title, description, position, status, learning_level, learning_objectives, estimated_minutes, support_guidance)
  values
    (v_course_id, 'Digital confidence, access, and information', 'A foundation-level draft module for safe and inclusive access to digital tools, credible information, and productive study habits.', 0, 'draft', 'foundation', '["Identify practical device, browser, and account-access habits for online learning.","Recognise credible and relevant information sources.","Use basic accessibility and digital-wellbeing practices."]'::jsonb, 360, 'Provide device-access alternatives, a glossary of key terms, and accessible study materials before review.'),
    (v_course_id, 'Collaborative remote work', 'A developing-level draft module for responsible communication, shared work, and participation in remote teams.', 1, 'draft', 'developing', '["Use clear, respectful, and inclusive online communication.","Organise shared tasks and simple digital collaboration workflows.","Apply basic privacy and account-security practices in remote work."]'::jsonb, 480, 'Include captioned demonstrations, downloadable practice templates, and guidance for learners with limited connectivity.'),
    (v_course_id, 'Digital entrepreneurship and opportunity', 'An applied-level draft module for identifying needs, evaluating an idea, and planning practical value creation.', 2, 'draft', 'applied', '["Identify a problem or opportunity relevant to a community or audience.","Explain how an idea can create social, cultural, or financial value.","Develop a simple evidence-based opportunity statement and action plan."]'::jsonb, 480, 'Offer optional examples from varied local contexts and use clear templates rather than assuming business experience.'),
    (v_course_id, 'Responsible remote-work project plan', 'A capstone-level draft module for bringing digital, collaboration, and entrepreneurship learning together in a planned deliverable.', 3, 'draft', 'capstone', '["Prepare a small remote-work or digital-project plan.","Explain ethical, inclusion, privacy, and accessibility considerations.","Reflect on evidence, feedback, and next learning steps."]'::jsonb, 480, 'Provide a transparent assessment rubric, feedback route, and reasonable adjustment process before any learner activity is released.');

  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), 'digital_starter_module_outline_initialized', 'course', v_course_id, jsonb_build_object('module_count', 4, 'status', 'draft', 'creates_lessons', false, 'creates_materials', false, 'creates_assessments', false));
  return jsonb_build_object('course_id', v_course_id, 'created', true, 'module_count', 4, 'status', 'draft');
end;
$$;

revoke all on function public.niu_initialize_digital_starter_modules() from public, anon;
grant execute on function public.niu_initialize_digital_starter_modules() to authenticated;
