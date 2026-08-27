-- Creates the minimum draft lesson scaffold for NIU's recommended first-course modules without adding learning material.
create or replace function public.niu_initialize_digital_starter_lessons()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_course_id uuid;
declare v_existing_count integer;
declare v_created_count integer := 0;
declare v_module record;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin' and account_status = 'active') then raise exception 'Active Super Administrator authorization is required'; end if;
  select id into v_course_id from public.courses where slug = 'digital-foundations-enterprise-remote-work' limit 1;
  if v_course_id is null then raise exception 'Create the NIU starter programme structure before initializing its lesson scaffold'; end if;
  select count(*) into v_existing_count from public.lessons l join public.course_modules m on m.id = l.module_id where m.course_id = v_course_id;
  if v_existing_count > 0 then return jsonb_build_object('course_id', v_course_id, 'created', false, 'lesson_count', v_existing_count, 'reason', 'Existing lessons were retained'); end if;

  for v_module in select id, position from public.course_modules where course_id = v_course_id order by position loop
    if v_module.position = 0 then
      insert into public.lessons (module_id, title, kind, description, position, rich_text, is_required, learning_objectives, estimated_minutes, points, status)
      values (v_module.id, 'Access and information check-in', 'reading', 'A draft lesson placeholder for approved teaching materials about inclusive access, credible information, and safe digital learning habits.', 0, null, true, '["Identify practical access and account habits for online learning.","Recognise credible information sources for a learning task."]'::jsonb, 60, 0, 'draft');
    elsif v_module.position = 1 then
      insert into public.lessons (module_id, title, kind, description, position, rich_text, is_required, learning_objectives, estimated_minutes, points, status)
      values (v_module.id, 'Collaboration workspace plan', 'assignment', 'A draft lesson placeholder for an approved activity on respectful digital communication, shared tasks, and remote-work privacy.', 0, null, true, '["Prepare a simple plan for respectful and organised remote collaboration.","Identify a privacy or security practice relevant to shared work."]'::jsonb, 90, 0, 'draft');
    elsif v_module.position = 2 then
      insert into public.lessons (module_id, title, kind, description, position, rich_text, is_required, learning_objectives, estimated_minutes, points, status)
      values (v_module.id, 'Opportunity discovery worksheet', 'assignment', 'A draft lesson placeholder for an approved activity exploring a community, audience, or digital-work opportunity.', 0, null, true, '["Describe a relevant problem or opportunity.","Develop a simple evidence-based statement of value and next steps."]'::jsonb, 90, 0, 'draft');
    elsif v_module.position = 3 then
      insert into public.lessons (module_id, title, kind, description, position, rich_text, is_required, learning_objectives, estimated_minutes, points, status)
      values (v_module.id, 'Responsible project-plan reflection', 'assignment', 'A draft lesson placeholder for an approved final project-planning and reflection activity that considers ethics, inclusion, privacy, and accessibility.', 0, null, true, '["Prepare a small digital or remote-work project plan.","Reflect on ethical, inclusive, private, and accessible implementation choices."]'::jsonb, 90, 0, 'draft');
    else
      continue;
    end if;
    v_created_count := v_created_count + 1;
  end loop;

  if v_created_count = 0 then raise exception 'The NIU starter course requires the recommended module outline before lesson scaffolding'; end if;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), 'digital_starter_lesson_scaffold_initialized', 'course', v_course_id, jsonb_build_object('lesson_count', v_created_count, 'status', 'draft', 'creates_materials', false, 'creates_assessments', false, 'creates_learners', false));
  return jsonb_build_object('course_id', v_course_id, 'created', true, 'lesson_count', v_created_count, 'status', 'draft');
end;
$$;

revoke all on function public.niu_initialize_digital_starter_lessons() from public, anon;
grant execute on function public.niu_initialize_digital_starter_lessons() to authenticated;
