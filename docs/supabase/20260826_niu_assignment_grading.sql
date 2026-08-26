create or replace function public.niu_grade_assignment_submission(
  target_submission_id uuid,
  target_score numeric,
  target_feedback text default null,
  target_release boolean default true
)
returns public.gradebook_entries
language plpgsql
security definer
set search_path = public
as $$
declare target_submission public.assignment_submissions;
declare target_assignment public.assignments;
declare output_grade public.gradebook_entries;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then raise exception 'Academic staff authorization is required'; end if;
  select * into target_submission from public.assignment_submissions where id = target_submission_id for update;
  if not found then raise exception 'Submitted assignment was not found'; end if;
  select * into target_assignment from public.assignments where id = target_submission.assignment_id;
  if not found then raise exception 'Assignment was not found'; end if;
  if target_score < 0 or target_score > target_assignment.points then raise exception 'Score must be between zero and the assignment points available'; end if;

  update public.assignment_submissions
    set score = target_score, feedback = nullif(trim(target_feedback), ''), graded_at = now(), graded_by = auth.uid()
  where id = target_submission.id;

  select * into output_grade from public.gradebook_entries
  where user_id = target_submission.user_id and assignment_id = target_assignment.id
  order by created_at desc limit 1 for update;
  if found then
    update public.gradebook_entries set score = target_score, points_available = target_assignment.points, grade_status = case when target_release then 'released' else 'draft' end, graded_by = auth.uid(), graded_at = now(), feedback = nullif(trim(target_feedback), '') where id = output_grade.id returning * into output_grade;
  else
    insert into public.gradebook_entries (user_id, course_id, assignment_id, score, points_available, grade_status, graded_by, graded_at, feedback)
    values (target_submission.user_id, target_assignment.course_id, target_assignment.id, target_score, target_assignment.points, case when target_release then 'released' else 'draft' end, auth.uid(), now(), nullif(trim(target_feedback), '')) returning * into output_grade;
  end if;
  return output_grade;
end;
$$;

grant execute on function public.niu_grade_assignment_submission(uuid, numeric, text, boolean) to authenticated;
