-- Controlled correction/reissue. The prior credential remains in history as superseded.
create or replace function public.niu_reissue_certificate(
  target_certificate_id uuid,
  target_reason text,
  target_final_score numeric default null
)
returns table (certificate_id uuid, credential_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  original public.certificates;
  replacement public.certificates;
begin
  if auth.uid() is null or not public.niu_is_registrar() then
    raise exception 'Registrar or administrator authorization is required';
  end if;
  if char_length(trim(coalesce(target_reason, ''))) < 3 then
    raise exception 'A reissue reason of at least three characters is required';
  end if;
  select * into original from public.certificates where id = target_certificate_id for update;
  if not found or original.status <> 'active' then
    raise exception 'Only an active credential can be reissued';
  end if;
  if target_final_score is not null and (target_final_score < 0 or target_final_score > 100) then
    raise exception 'A replacement final score must be between 0 and 100';
  end if;
  update public.certificates set status = 'superseded', revocation_reason = 'Superseded after reissue: ' || trim(target_reason) where id = original.id;
  insert into public.certificates (
    user_id, course_id, program_id, credential_title, final_score, issued_at,
    status, approved_at, approved_by, public_display_name, share_recipient_name,
    learning_hours, certificate_path, qr_payload
  ) values (
    original.user_id, original.course_id, original.program_id, original.credential_title,
    coalesce(target_final_score, original.final_score), now(), 'active', now(), auth.uid(),
    original.public_display_name, original.share_recipient_name, original.learning_hours, null, null
  ) returning * into replacement;
  return query select replacement.id, replacement.credential_number;
end;
$$;

revoke all on function public.niu_reissue_certificate(uuid, text, numeric) from public, anon;
grant execute on function public.niu_reissue_certificate(uuid, text, numeric) to authenticated;
