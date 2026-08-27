-- Internal trigger helper: do not expose direct candidate recalculation to arbitrary authenticated callers.
revoke all on function public.niu_auto_issue_certificate_for_program_enrollment(uuid) from public;
