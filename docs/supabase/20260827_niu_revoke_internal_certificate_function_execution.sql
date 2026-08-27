-- These SECURITY DEFINER functions are internal trigger helpers only.
-- PostgreSQL triggers continue to execute them; browser/API roles must not.
revoke all on function public.niu_auto_issue_certificate_for_program_enrollment(uuid) from public, anon, authenticated;
revoke all on function public.niu_program_completion_certificate_trigger() from public, anon, authenticated;
