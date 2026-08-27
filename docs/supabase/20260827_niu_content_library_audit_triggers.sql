-- Ensure every direct, role-authorised content-library record and attachment
-- mutation is captured by NIU's existing security-definer audit trigger.

drop trigger if exists niu_audit_content_library_items on public.content_library_items;
create trigger niu_audit_content_library_items
after insert or update or delete on public.content_library_items
for each row execute function public.niu_capture_audit_event();

drop trigger if exists niu_audit_lesson_content_items on public.lesson_content_items;
create trigger niu_audit_lesson_content_items
after insert or update or delete on public.lesson_content_items
for each row execute function public.niu_capture_audit_event();
