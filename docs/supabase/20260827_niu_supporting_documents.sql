-- Lawful supporting documents are authored and issued by NIU staff; no document is generated from unsupported claims.
create table if not exists public.credential_supporting_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  program_id uuid not null references public.certificate_programs(id) on delete restrict,
  certificate_id uuid references public.certificates(id) on delete restrict,
  document_type text not null check (document_type in ('completion_letter', 'recommendation_letter')),
  title text not null check (char_length(title) between 3 and 255),
  body text not null check (char_length(body) between 30 and 20000),
  status text not null default 'draft' check (status in ('draft', 'issued', 'revoked')),
  authored_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists credential_supporting_documents_user_idx on public.credential_supporting_documents(user_id, status, updated_at desc);
alter table public.credential_supporting_documents enable row level security;
drop policy if exists supporting_documents_own_issued on public.credential_supporting_documents;
create policy supporting_documents_own_issued on public.credential_supporting_documents for select to authenticated using (user_id = auth.uid() and status = 'issued');
drop policy if exists supporting_documents_staff_manage on public.credential_supporting_documents;
create policy supporting_documents_staff_manage on public.credential_supporting_documents for all to authenticated using (public.niu_is_registrar()) with check (public.niu_is_registrar());
create or replace function public.niu_create_supporting_document(target_user_id uuid, target_program_id uuid, target_certificate_id uuid, target_document_type text, target_title text, target_body text)
returns public.credential_supporting_documents
language plpgsql security definer set search_path = public
as $$
declare created_document public.credential_supporting_documents;
begin
  if auth.uid() is null or not public.niu_is_registrar() then raise exception 'Registrar or administrator authorization is required'; end if;
  if target_document_type not in ('completion_letter', 'recommendation_letter') then raise exception 'Unsupported supporting document type'; end if;
  if char_length(trim(target_title)) < 3 or char_length(trim(target_body)) < 30 then raise exception 'A title and substantive document body are required'; end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then raise exception 'Learner record was not found'; end if;
  if not exists (select 1 from public.certificate_programs where id = target_program_id and award_type = 'certificate') then raise exception 'Certificate programme was not found'; end if;
  insert into public.credential_supporting_documents (user_id, program_id, certificate_id, document_type, title, body, status, authored_by)
  values (target_user_id, target_program_id, target_certificate_id, target_document_type, trim(target_title), trim(target_body), 'draft', auth.uid()) returning * into created_document;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata) values (auth.uid(), 'supporting_document_created', 'credential_supporting_document', created_document.id, jsonb_build_object('document_type', target_document_type, 'learner_id', target_user_id));
  return created_document;
end;
$$;
create or replace function public.niu_issue_supporting_document(target_document_id uuid)
returns public.credential_supporting_documents
language plpgsql security definer set search_path = public
as $$
declare issued_document public.credential_supporting_documents;
begin
  if auth.uid() is null or not public.niu_is_registrar() then raise exception 'Registrar or administrator authorization is required'; end if;
  update public.credential_supporting_documents set status = 'issued', reviewed_by = auth.uid(), issued_at = now(), updated_at = now() where id = target_document_id and status = 'draft' returning * into issued_document;
  if not found then raise exception 'Only an existing draft supporting document can be issued'; end if;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata) values (auth.uid(), 'supporting_document_issued', 'credential_supporting_document', target_document_id, jsonb_build_object('document_type', issued_document.document_type));
  return issued_document;
end;
$$;
revoke all on function public.niu_create_supporting_document(uuid, uuid, uuid, text, text, text) from public;
revoke all on function public.niu_issue_supporting_document(uuid) from public;
grant execute on function public.niu_create_supporting_document(uuid, uuid, uuid, text, text, text) to authenticated;
grant execute on function public.niu_issue_supporting_document(uuid) to authenticated;
