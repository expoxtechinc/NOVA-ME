revoke execute on function public.audit_course_content_delete() from public, anon, authenticated;
revoke execute on function public.niu_capture_audit_event() from public, anon, authenticated;
revoke execute on function public.niu_enroll_in_course(uuid) from public, anon;
revoke execute on function public.niu_grade_assignment_submission(uuid, numeric, text, boolean) from public, anon;
revoke execute on function public.niu_issue_certificate(uuid, numeric, text, boolean) from public, anon;
revoke execute on function public.niu_update_credential_status(uuid, text, text) from public, anon;
revoke execute on function public.niu_record_learning_progress(uuid, text, numeric, integer, integer) from public, anon;
revoke execute on function public.niu_is_academic_staff() from public, anon;
revoke execute on function public.niu_is_administrator() from public, anon;
revoke execute on function public.niu_is_registrar() from public, anon;

grant execute on function public.niu_enroll_in_course(uuid) to authenticated;
grant execute on function public.niu_grade_assignment_submission(uuid, numeric, text, boolean) to authenticated;
grant execute on function public.niu_issue_certificate(uuid, numeric, text, boolean) to authenticated;
grant execute on function public.niu_update_credential_status(uuid, text, text) to authenticated;
grant execute on function public.niu_record_learning_progress(uuid, text, numeric, integer, integer) to authenticated;
grant execute on function public.niu_is_academic_staff() to authenticated;
grant execute on function public.niu_is_administrator() to authenticated;
grant execute on function public.niu_is_registrar() to authenticated;

-- This function intentionally remains anonymous for the server-backed public verification service.
revoke execute on function public.verify_niu_credential(text) from public;
grant execute on function public.verify_niu_credential(text) to anon, authenticated;
