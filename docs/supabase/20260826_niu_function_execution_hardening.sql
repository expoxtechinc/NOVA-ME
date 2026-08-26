-- Restrict the default PUBLIC execution grant on SECURITY DEFINER functions.
-- Public verification remains intentionally callable and returns minimal data.

revoke execute on function public.niu_is_academic_staff() from public, anon;
revoke execute on function public.niu_is_administrator() from public, anon;
revoke execute on function public.niu_next_credential_number() from public, anon, authenticated;
revoke execute on function public.niu_assign_credential_number() from public, anon, authenticated;
revoke execute on function public.niu_record_credential_status() from public, anon, authenticated;
revoke execute on function public.niu_record_learning_progress(uuid, text, numeric, integer, integer) from public, anon;
revoke execute on function public.verify_niu_credential(text) from public;

grant execute on function public.niu_is_academic_staff() to authenticated;
grant execute on function public.niu_is_administrator() to authenticated;
grant execute on function public.niu_record_learning_progress(uuid, text, numeric, integer, integer) to authenticated;
grant execute on function public.verify_niu_credential(text) to anon, authenticated;
