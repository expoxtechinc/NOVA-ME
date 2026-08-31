-- NIU governed question approval and safe lesson archival.
-- Status changes remain server-authorized and audited; no records are rewritten here.

create or replace function public.niu_transition_academic_record(target_type text, target_id uuid, target_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  before_record jsonb;
  after_record jsonb;
  current_status text;
begin
  if actor is null or not public.niu_is_academic_staff() then raise exception 'Academic staff authorization is required'; end if;
  if target_type not in ('course','module','lesson','assessment','certificate_template','question') then raise exception 'Unsupported academic record type'; end if;
  if target_status not in ('review','approved') then raise exception 'Only Review and Approved transitions are available'; end if;

  if target_type = 'course' then
    select to_jsonb(c), c.status::text into before_record, current_status from public.courses c where c.id=target_id;
    if before_record is null then raise exception 'Course not found'; end if;
    if target_status='approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.courses set status=target_status::public.course_status, updated_at=now() where id=target_id returning to_jsonb(courses) into after_record;
  elsif target_type = 'module' then
    select to_jsonb(m), m.status into before_record, current_status from public.course_modules m where m.id=target_id;
    if before_record is null then raise exception 'Module not found'; end if;
    if target_status='approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.course_modules set status=target_status where id=target_id returning to_jsonb(course_modules) into after_record;
  elsif target_type = 'lesson' then
    select to_jsonb(l), l.status into before_record, current_status from public.lessons l where l.id=target_id;
    if before_record is null then raise exception 'Lesson not found'; end if;
    if target_status='approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.lessons set status=target_status where id=target_id returning to_jsonb(lessons) into after_record;
  elsif target_type = 'assessment' then
    select to_jsonb(a), a.status into before_record, current_status from public.assessments a where a.id=target_id;
    if before_record is null then raise exception 'Assessment not found'; end if;
    if target_status='approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.assessments set status=target_status, updated_at=now() where id=target_id returning to_jsonb(assessments) into after_record;
  elsif target_type = 'certificate_template' then
    select to_jsonb(t), t.status into before_record, current_status from public.certificate_templates t where t.id=target_id;
    if before_record is null then raise exception 'Certificate template not found'; end if;
    if target_status='approved' and current_status <> 'review' then raise exception 'Draft content must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review content can transition'; end if;
    update public.certificate_templates set status=target_status, updated_at=now() where id=target_id returning to_jsonb(certificate_templates) into after_record;
  else
    select to_jsonb(q), q.approval_status into before_record, current_status from public.questions q where q.id=target_id;
    if before_record is null then raise exception 'Question not found'; end if;
    if target_status='approved' and current_status <> 'review' then raise exception 'Draft question must enter Review before approval'; end if;
    if current_status not in ('draft','review') then raise exception 'Only Draft or Review questions can transition'; end if;
    update public.questions set approval_status=target_status, approved_by=case when target_status='approved' then actor else null end, approved_at=case when target_status='approved' then now() else null end, updated_at=now() where id=target_id returning to_jsonb(questions) into after_record;
  end if;

  insert into public.audit_events(actor_id, action, subject_type, subject_id, metadata)
  values(actor,'UPDATE',target_type,target_id,jsonb_build_object('event','academic_record_status_changed','from',current_status,'to',target_status,'before',before_record,'after',after_record));
  return jsonb_build_object('record_type',target_type,'record_id',target_id,'status',target_status,'audit_recorded',true);
end;
$function$;

revoke all on function public.niu_transition_academic_record(text,uuid,text) from public,anon;
grant execute on function public.niu_transition_academic_record(text,uuid,text) to authenticated;

drop function if exists public.niu_archive_academic_record(text,uuid);
create or replace function public.niu_archive_academic_record(target_type text, target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $archive$
declare actor uuid := auth.uid(); before_record jsonb; after_record jsonb; current_status text;
begin
  if actor is null or not public.niu_is_academic_staff() then raise exception 'Academic staff authorization is required'; end if;
  if target_type <> 'lesson' then raise exception 'Only lessons may be archived by this governed action'; end if;
  select to_jsonb(l), l.status into before_record,current_status from public.lessons l where l.id=target_id for update;
  if before_record is null then raise exception 'Lesson not found'; end if;
  if current_status='published' then raise exception 'Published lessons cannot be archived'; end if;
  update public.lessons set status='archived' where id=target_id returning to_jsonb(lessons) into after_record;
  insert into public.audit_events(actor_id,action,subject_type,subject_id,metadata)
  values(actor,'UPDATE',target_type,target_id,jsonb_build_object('event','academic_record_archived','from',current_status,'to','archived','before',before_record,'after',after_record));
  return jsonb_build_object('record_type',target_type,'record_id',target_id,'status','archived','audit_recorded',true);
end;
$archive$;
revoke all on function public.niu_archive_academic_record(text,uuid) from public,anon;
grant execute on function public.niu_archive_academic_record(text,uuid) to authenticated;
