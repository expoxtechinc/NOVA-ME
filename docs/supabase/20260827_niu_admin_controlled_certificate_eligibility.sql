-- NIU certificate-only safety repair: completion calculates eligibility but never self-issues a credential.
-- A registrar/administrator must review, approve, and call niu_issue_certificate.
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
  existing_candidate public.certificate_candidates;
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

  select * into existing_candidate
  from public.certificate_candidates
  where user_id = target_enrollment.user_id and program_id = target_enrollment.program_id;
  if existing_candidate.eligibility_status in ('approved', 'issued') then return; end if;

  if required_courses = 0 or completed_courses <> required_courses then
    insert into public.certificate_candidates (user_id, program_id, eligibility_status, eligibility_snapshot, updated_at)
    values (target_enrollment.user_id, target_enrollment.program_id, 'ineligible', jsonb_build_object('reason', 'required_courses_incomplete', 'required_courses', required_courses, 'completed_courses', completed_courses, 'automatic_eligibility_check', true), now())
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
    values (target_enrollment.user_id, target_enrollment.program_id, 'ineligible', jsonb_build_object('reason', 'required_score_not_met', 'final_score', calculated_score, 'required_score', target_program.required_score, 'automatic_eligibility_check', true), now())
    on conflict (user_id, program_id) do update set eligibility_status = excluded.eligibility_status, eligibility_snapshot = excluded.eligibility_snapshot, updated_at = now();
    return;
  end if;

  insert into public.certificate_candidates (user_id, program_id, eligibility_status, eligibility_snapshot, updated_at)
  values (target_enrollment.user_id, target_enrollment.program_id, 'eligible', jsonb_build_object('automatic_eligibility_check', true, 'final_score', calculated_score, 'required_score', target_program.required_score, 'required_courses', required_courses, 'completed_courses', completed_courses, 'administrator_approval_required', true), now())
  on conflict (user_id, program_id) do update set eligibility_status = excluded.eligibility_status, eligibility_snapshot = excluded.eligibility_snapshot, updated_at = now();
end;
$$;

revoke all on function public.niu_auto_issue_certificate_for_program_enrollment(uuid) from public;
-- The live course-enrollment and grade-release triggers call the replacement recalculation helper; no client grant is required.
