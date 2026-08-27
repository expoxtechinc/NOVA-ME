-- Registrar review is a protected state transition, not a client-side row update.
create or replace function public.niu_review_certificate_candidate(target_candidate_id uuid, target_status text, target_notes text default null)
returns public.certificate_candidates
language plpgsql
security definer
set search_path = public
as $$
declare updated_candidate public.certificate_candidates;
  current_candidate public.certificate_candidates;
begin
  if auth.uid() is null or not public.niu_is_registrar() then raise exception 'Registrar or administrator authorization is required'; end if;
  if target_status not in ('under_review', 'approved', 'rejected') then raise exception 'Unsupported candidate review status'; end if;
  select * into current_candidate from public.certificate_candidates where id = target_candidate_id for update;
  if not found then raise exception 'Certificate candidate was not found'; end if;
  if target_status = 'under_review' and current_candidate.eligibility_status <> 'eligible' then raise exception 'Only eligible candidates may enter review'; end if;
  if target_status = 'approved' and current_candidate.eligibility_status <> 'under_review' then raise exception 'Only candidates under review may be approved'; end if;
  if target_status = 'rejected' and current_candidate.eligibility_status not in ('eligible', 'under_review') then raise exception 'Only eligible candidates may be rejected'; end if;
  update public.certificate_candidates set eligibility_status = target_status, reviewed_by = auth.uid(), reviewed_at = now(), review_notes = nullif(trim(target_notes), ''), updated_at = now() where id = target_candidate_id returning * into updated_candidate;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata) values (auth.uid(), 'certificate_candidate_reviewed', 'certificate_candidate', target_candidate_id, jsonb_build_object('from_status', current_candidate.eligibility_status, 'to_status', target_status));
  return updated_candidate;
end;
$$;
revoke all on function public.niu_review_certificate_candidate(uuid, text, text) from public;
grant execute on function public.niu_review_certificate_candidate(uuid, text, text) to authenticated;
