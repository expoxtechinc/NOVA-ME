-- Automatic certificate issuance remains limited to NIU certificate programmes.
-- A programme enrolment must be completed, every required course must be completed,
-- and the calculated released-grade score must meet the configured programme threshold.

create or replace function public.niu_auto_issue_certificate_for_program_enrollment(target_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_enrollment public.program_enrollments;
  target_program public.certificate_programs;
  required_courses integer;
  completed_courses integer;
  calculated_score numeric(5,2);
  issued_certificate_id uuid;
  first_course_id uuid;
begin
  select * into target_enrollment from public.program_enrollments where id = target_enrollment_id for update;
  if not found or target_enrollment.status <> 'completed' then return; end if;

  select * into target_program from public.certificate_programs where id = target_enrollment.program_id;
  if not found or target_program.award_type <> 'certificate' then return; end if;

  select count(*) into required_courses from public.program_courses where program_id = target_enrollment.program_id and is_required;
  select count(*) into completed_courses
  from public.program_courses pc
  join public.enrollments e on e.course_id = pc.course_id
  where pc.program_id = target_enrollment.program_id
    and pc.is_required
    and e.user_id = target_enrollment.user_id
    and e.status = 'completed';

  if required_courses = 0 or completed_courses <> required_courses then
    insert into public.certificate_candidates (user_id, program_id, eligibility_status, eligibility_snapshot, updated_at)
    values (target_enrollment.user_id, target_enrollment.program_id, 'ineligible', jsonb_build_object('reason', 'required_courses_incomplete', 'required_courses', required_courses, 'completed_courses', completed_courses), now())
    on conflict (user_id, program_id) do update set eligibility_status = excluded.eligibility_status, eligibility_snapshot = excluded.eligibility_snapshot, updated_at = now();
    return;
  end if;

  select coalesce(round((sum(g.score) / nullif(sum(g.points_available), 0)) * 100, 2), 100)
  into calculated_score
  from public.gradebook_entries g
  join public.program_courses pc on pc.course_id = g.course_id
  where pc.program_id = target_enrollment.program_id
    and pc.is_required
    and g.user_id = target_enrollment.user_id
    and g.grade_status = 'released';

  if calculated_score < target_program.required_score then
    insert into public.certificate_candidates (user_id, program_id, eligibility_status, eligibility_snapshot, updated_at)
    values (target_enrollment.user_id, target_enrollment.program_id, 'ineligible', jsonb_build_object('reason', 'required_score_not_met', 'final_score', calculated_score, 'required_score', target_program.required_score), now())
    on conflict (user_id, program_id) do update set eligibility_status = excluded.eligibility_status, eligibility_snapshot = excluded.eligibility_snapshot, updated_at = now();
    return;
  end if;

  select course_id into first_course_id from public.program_courses where program_id = target_enrollment.program_id and is_required order by position limit 1;
  if exists (select 1 from public.certificates where user_id = target_enrollment.user_id and program_id = target_enrollment.program_id and status in ('pending', 'active', 'superseded')) then return; end if;

  insert into public.certificate_candidates (user_id, program_id, eligibility_status, eligibility_snapshot, updated_at)
  values (target_enrollment.user_id, target_enrollment.program_id, 'approved', jsonb_build_object('automatic_issuance', true, 'final_score', calculated_score, 'required_score', target_program.required_score, 'required_courses', required_courses, 'completed_courses', completed_courses), now())
  on conflict (user_id, program_id) do update set eligibility_status = excluded.eligibility_status, eligibility_snapshot = excluded.eligibility_snapshot, updated_at = now();

  insert into public.certificates (user_id, course_id, program_id, credential_title, final_score, issued_at, status, approved_at, approved_by, learning_hours)
  values (target_enrollment.user_id, first_course_id, target_enrollment.program_id, target_program.name, calculated_score, now(), 'active', now(), null, target_program.duration_hours)
  returning id into issued_certificate_id;

  update public.certificate_candidates set eligibility_status = 'issued', reviewed_at = now(), updated_at = now() where user_id = target_enrollment.user_id and program_id = target_enrollment.program_id;
  insert into public.notifications (user_id, title, body, notification_type, action_url)
  values (target_enrollment.user_id, 'Your NIU certificate is available', 'You completed all verified requirements for your certificate programme. Your certificate is now available in My NIU.', 'certificate_issued', '/credentials/' || issued_certificate_id::text);
end;
$$;

create or replace function public.niu_program_completion_certificate_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    perform public.niu_auto_issue_certificate_for_program_enrollment(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists niu_program_completion_certificate on public.program_enrollments;
create trigger niu_program_completion_certificate
after insert or update of status on public.program_enrollments
for each row execute function public.niu_program_completion_certificate_trigger();
