create or replace function public.niu_is_registrar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.niu_is_administrator() or exists (
    select 1 from public.profile_role_assignments r
    where r.profile_id = auth.uid() and r.institutional_role = 'registrar'
  );
$$;

create or replace function public.niu_issue_certificate(
  target_candidate_id uuid,
  target_final_score numeric,
  target_public_display_name text default null,
  target_share_recipient_name boolean default false
)
returns table (certificate_id uuid, credential_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate public.certificate_candidates;
  target_course_id uuid;
  created_certificate public.certificates;
begin
  if auth.uid() is null or not public.niu_is_registrar() then
    raise exception 'Registrar or administrator authorization is required';
  end if;

  select * into candidate from public.certificate_candidates where id = target_candidate_id for update;
  if not found then raise exception 'Certificate candidate was not found'; end if;
  if candidate.eligibility_status <> 'approved' then raise exception 'Certificate candidate must be approved before issuance'; end if;
  if target_final_score is null or target_final_score < 0 or target_final_score > 100 then raise exception 'A final score between 0 and 100 is required'; end if;
  if exists (select 1 from public.certificates c where c.user_id = candidate.user_id and c.program_id = candidate.program_id and c.status in ('pending', 'active', 'superseded')) then
    raise exception 'An active or pending credential already exists for this program';
  end if;

  select pc.course_id into target_course_id from public.program_courses pc where pc.program_id = candidate.program_id order by pc.position limit 1;
  if target_course_id is null then raise exception 'The approved program needs at least one linked course before issuance'; end if;

  insert into public.certificates (
    user_id, course_id, program_id, credential_title, final_score, issued_at,
    status, approved_at, approved_by, public_display_name, share_recipient_name, learning_hours
  )
  select candidate.user_id, target_course_id, candidate.program_id, p.name, target_final_score, now(),
    'active', now(), auth.uid(), nullif(trim(target_public_display_name), ''), target_share_recipient_name, p.duration_hours
  from public.certificate_programs p where p.id = candidate.program_id
  returning * into created_certificate;

  update public.certificate_candidates
    set eligibility_status = 'issued', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = candidate.id;

  return query select created_certificate.id, created_certificate.credential_number;
end;
$$;

create or replace function public.niu_update_credential_status(
  target_certificate_id uuid,
  target_status text,
  target_reason text default null
)
returns public.certificates
language plpgsql
security definer
set search_path = public
as $$
declare updated_certificate public.certificates;
begin
  if auth.uid() is null or not public.niu_is_registrar() then
    raise exception 'Registrar or administrator authorization is required';
  end if;
  if target_status not in ('active', 'revoked', 'superseded') then raise exception 'Unsupported credential status'; end if;
  if target_status = 'revoked' and nullif(trim(target_reason), '') is null then raise exception 'A revocation reason is required'; end if;
  update public.certificates
    set status = target_status,
        revoked_at = case when target_status = 'revoked' then now() else revoked_at end,
        revoked_by = case when target_status = 'revoked' then auth.uid() else revoked_by end,
        revocation_reason = case when target_status = 'revoked' then trim(target_reason) else revocation_reason end
  where id = target_certificate_id
  returning * into updated_certificate;
  if not found then raise exception 'Credential was not found'; end if;
  return updated_certificate;
end;
$$;

grant execute on function public.niu_is_registrar() to authenticated;
grant execute on function public.niu_issue_certificate(uuid, numeric, text, boolean) to authenticated;
grant execute on function public.niu_update_credential_status(uuid, text, text) to authenticated;
