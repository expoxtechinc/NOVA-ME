-- NIU protected material storage: private by default and limited to the roles
-- already authorised by NIU's content-library and enrollment RLS policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'niu-learning-materials',
  'niu-learning-materials',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists niu_learning_materials_staff_insert on storage.objects;
create policy niu_learning_materials_staff_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'niu-learning-materials'
  and public.niu_is_academic_staff()
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists niu_learning_materials_enrolled_or_staff_select on storage.objects;
create policy niu_learning_materials_enrolled_or_staff_select
on storage.objects for select to authenticated
using (
  bucket_id = 'niu-learning-materials'
  and (
    public.niu_is_academic_staff()
    or exists (
      select 1
      from public.content_library_items item
      join public.lesson_content_items attachment on attachment.content_item_id = item.id
      join public.lessons lesson on lesson.id = attachment.lesson_id
      join public.course_modules module on module.id = lesson.module_id
      join public.enrollments enrollment on enrollment.course_id = module.course_id
      where item.storage_path = storage.objects.name
        and enrollment.user_id = auth.uid()
        and enrollment.status in ('active', 'completed')
    )
  )
);
