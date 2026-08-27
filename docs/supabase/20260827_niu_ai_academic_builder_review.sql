-- Additive source-review fields for the AI Academic Builder.
-- No jobs or academic records are created or altered by this migration.

alter table public.ai_academic_builder_jobs
  add column if not exists research_sources jsonb not null default '[]'::jsonb,
  add column if not exists research_notes text not null default '';

create or replace function public.niu_validate_ai_builder_review_submission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'generation_review' and (jsonb_array_length(new.research_sources) = 0 or length(trim(new.research_notes)) < 20) then
    raise exception 'AI Builder generation review requires at least one source record and research notes of at least 20 characters';
  end if;
  return new;
end;
$$;

drop trigger if exists ai_academic_builder_jobs_review_guard on public.ai_academic_builder_jobs;
create trigger ai_academic_builder_jobs_review_guard
before update on public.ai_academic_builder_jobs
for each row execute function public.niu_validate_ai_builder_review_submission();
