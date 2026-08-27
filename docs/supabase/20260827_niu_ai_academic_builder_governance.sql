-- Future-only governance for AI Academic Builder jobs.
-- Existing rows are preserved; no job or academic record is created here.

create or replace function public.niu_validate_ai_academic_builder_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_role text;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required for AI Builder workflow changes';
  end if;

  if tg_op = 'UPDATE' and new.status <> old.status then
    if not (
      (old.status = 'draft' and new.status = 'planning') or
      (old.status = 'planning' and new.status in ('research_review','failed')) or
      (old.status = 'research_review' and new.status in ('generation_review','validation_failed','failed')) or
      (old.status = 'generation_review' and new.status in ('ready_for_review','validation_failed','failed')) or
      (old.status = 'validation_failed' and new.status in ('research_review','generation_review','failed')) or
      (old.status = 'ready_for_review' and new.status in ('approved','validation_failed')) or
      (old.status = 'approved' and new.status in ('published','archived')) or
      (old.status = 'published' and new.status = 'archived')
    ) then
      raise exception 'AI Builder status transition % → % is not permitted', old.status, new.status;
    end if;
  end if;

  if new.status in ('approved','published') then
    select role into actor_role from public.profiles where id = auth.uid();
    if actor_role not in ('administrator','super_admin') then
      raise exception 'Administrator authorization is required for AI Builder approval or publication';
    end if;
  end if;

  if old.status = 'published' and new.status <> 'published' and new.status <> 'archived' then
    raise exception 'Published AI Builder jobs can only be archived';
  end if;

  return new;
end;
$$;

drop trigger if exists ai_academic_builder_jobs_status_guard on public.ai_academic_builder_jobs;
create trigger ai_academic_builder_jobs_status_guard
before update on public.ai_academic_builder_jobs
for each row execute function public.niu_validate_ai_academic_builder_status();
