revoke execute on function public.niu_course_enrollment_eligibility_trigger() from anon, authenticated;
revoke execute on function public.niu_grade_release_eligibility_trigger() from anon, authenticated;
revoke execute on function public.niu_recalculate_certificate_candidate(uuid, uuid) from anon, authenticated;
revoke execute on function public.niu_auto_issue_certificate_for_program_enrollment(uuid) from anon, authenticated;
