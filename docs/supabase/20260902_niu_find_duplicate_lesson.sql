-- NIU Programme Builder: reliable lesson duplicate lookup
-- Read-only, staff-authorized helper for Step 3. It does not create, update,
-- delete, archive, or alter lessons or programme relationships.
create or replace function public.niu_find_duplicate_lesson(
  target_module_id uuid,
  target_title text,
  excluded_lesson_id uuid default null
)
returns table (id uuid, title text, status text)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required';
  end if;

  if target_module_id is null or nullif(btrim(target_title), '') is null then
    return;
  end if;

  return query
  select l.id, l.title, l.status
  from public.lessons l
  where l.module_id = target_module_id
    and l.status <> 'archived'
    and (excluded_lesson_id is null or l.id <> excluded_lesson_id)
    and lower(btrim(l.title)) = lower(btrim(target_title))
  order by l.position asc, l.id asc
  limit 1;
end;
$$;

revoke all on function public.niu_find_duplicate_lesson(uuid, text, uuid) from public;
grant execute on function public.niu_find_duplicate_lesson(uuid, text, uuid) to authenticated;
