-- NIU: protected audit record for the first original draft study guide.
-- This function is intentionally narrow: it records only the verified attachment
-- between NIU's first Digital Foundations lesson and its original study guide.

create or replace function public.niu_record_digital_starter_study_guide_audit(
  target_lesson_id uuid,
  target_content_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  verified_lesson_id uuid;
begin
  if not public.niu_is_active_super_admin() then
    raise exception 'Active Super Administrator authority is required';
  end if;

  select lesson.id
  into verified_lesson_id
  from public.lessons lesson
  join public.course_modules module on module.id = lesson.module_id
  join public.courses course on course.id = module.course_id
  join public.lesson_content_items attachment on attachment.lesson_id = lesson.id
  join public.content_library_items item on item.id = attachment.content_item_id
  where lesson.id = target_lesson_id
    and item.id = target_content_item_id
    and course.slug = 'digital-foundations-enterprise-remote-work'
    and module.position = 0
    and lesson.position = 0
    and item.category = 'study_guide'
    and item.file_name = 'niu-digital-foundations-study-guide.md'
    and attachment.is_required = true;

  if verified_lesson_id is null then
    raise exception 'The NIU digital starter study guide is not attached to the authorised first lesson';
  end if;

  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (
    auth.uid(),
    'digital_starter_study_guide_initialized',
    'lesson',
    verified_lesson_id,
    jsonb_build_object(
      'content_item_id', target_content_item_id,
      'category', 'study_guide',
      'status', 'draft',
      'original_niu_material', true
    )
  );

  return jsonb_build_object(
    'lesson_id', verified_lesson_id,
    'content_item_id', target_content_item_id,
    'status', 'draft'
  );
end;
$$;

revoke all on function public.niu_record_digital_starter_study_guide_audit(uuid, uuid) from public, anon;
grant execute on function public.niu_record_digital_starter_study_guide_audit(uuid, uuid) to authenticated;
