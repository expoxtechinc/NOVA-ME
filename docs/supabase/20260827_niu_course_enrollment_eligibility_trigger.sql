-- The learner-facing course workflow writes public.enrollments. Recalculate eligibility from that source of truth.
create or replace function public.niu_recalculate_certificate_candidate(target_user_id uuid, target_program_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare required_courses integer; completed_courses integer; calculated_score numeric(5,2); required_score numeric(5,2); existing_candidate public.certificate_candidates;
begin
  select cp.required_score into required_score from public.certificate_programs cp where cp.id = target_program_id and cp.award_type = 'certificate';
  if not found then return; end if;
  select count(*) into required_courses from public.program_courses where program_id = target_program_id and is_required;
  select count(*) into completed_courses from public.program_courses pc join public.enrollments e on e.course_id = pc.course_id and e.user_id = target_user_id and e.status = 'completed' where pc.program_id = target_program_id and pc.is_required;
  select * into existing_candidate from public.certificate_candidates where user_id = target_user_id and program_id = target_program_id;
  if existing_candidate.eligibility_status in ('approved', 'issued') then return; end if;
  select coalesce(round((sum(g.score) / nullif(sum(g.points_available), 0)) * 100, 2), 100) into calculated_score from public.gradebook_entries g join public.program_courses pc on pc.course_id = g.course_id where pc.program_id = target_program_id and pc.is_required and g.user_id = target_user_id and g.grade_status = 'released';
  if required_courses = 0 or completed_courses <> required_courses then
    insert into public.certificate_candidates (user_id, program_id, eligibility_status, eligibility_snapshot, updated_at) values (target_user_id, target_program_id, 'ineligible', jsonb_build_object('reason', 'required_courses_incomplete', 'required_courses', required_courses, 'completed_courses', completed_courses, 'automatic_eligibility_check', true), now()) on conflict (user_id, program_id) do update set eligibility_status = excluded.eligibility_status, eligibility_snapshot = excluded.eligibility_snapshot, updated_at = now();
  elsif calculated_score < required_score then
    insert into public.certificate_candidates (user_id, program_id, eligibility_status, eligibility_snapshot, updated_at) values (target_user_id, target_program_id, 'ineligible', jsonb_build_object('reason', 'required_score_not_met', 'final_score', calculated_score, 'required_score', required_score, 'automatic_eligibility_check', true), now()) on conflict (user_id, program_id) do update set eligibility_status = excluded.eligibility_status, eligibility_snapshot = excluded.eligibility_snapshot, updated_at = now();
  else
    insert into public.certificate_candidates (user_id, program_id, eligibility_status, eligibility_snapshot, updated_at) values (target_user_id, target_program_id, 'eligible', jsonb_build_object('automatic_eligibility_check', true, 'final_score', calculated_score, 'required_score', required_score, 'required_courses', required_courses, 'completed_courses', completed_courses, 'administrator_approval_required', true), now()) on conflict (user_id, program_id) do update set eligibility_status = excluded.eligibility_status, eligibility_snapshot = excluded.eligibility_snapshot, updated_at = now();
  end if;
end;
$$;
revoke all on function public.niu_recalculate_certificate_candidate(uuid, uuid) from public;

create or replace function public.niu_course_enrollment_eligibility_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare programme_id uuid;
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    for programme_id in select distinct pc.program_id from public.program_courses pc where pc.course_id = new.course_id and pc.is_required loop perform public.niu_recalculate_certificate_candidate(new.user_id, programme_id); end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists niu_course_enrollment_eligibility on public.enrollments;
create trigger niu_course_enrollment_eligibility after insert or update of status on public.enrollments for each row execute function public.niu_course_enrollment_eligibility_trigger();

create or replace function public.niu_grade_release_eligibility_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare programme_id uuid;
begin
  if new.grade_status = 'released' and (tg_op = 'INSERT' or old.grade_status is distinct from 'released' or old.score is distinct from new.score) then
    for programme_id in select distinct pc.program_id from public.program_courses pc where pc.course_id = new.course_id and pc.is_required loop perform public.niu_recalculate_certificate_candidate(new.user_id, programme_id); end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists niu_grade_release_eligibility on public.gradebook_entries;
create trigger niu_grade_release_eligibility after insert or update of grade_status, score on public.gradebook_entries for each row execute function public.niu_grade_release_eligibility_trigger();
