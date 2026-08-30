-- Explicit programme-package scope for modules and lessons.
-- This migration never deletes academic records; relationship cleanup below only detaches
-- the explicitly identified legacy links from NIU-IT-CDL.
create table if not exists public.program_modules (
  program_id uuid not null references public.certificate_programs(id) on delete cascade,
  module_id uuid not null references public.course_modules(id) on delete restrict,
  position integer not null check (position >= 0),
  is_required boolean not null default true,
  primary key (program_id, module_id)
);

create table if not exists public.program_lessons (
  program_id uuid not null references public.certificate_programs(id) on delete cascade,
  module_id uuid not null,
  lesson_id uuid not null references public.lessons(id) on delete restrict,
  position integer not null check (position >= 0),
  is_required boolean not null default true,
  primary key (program_id, lesson_id),
  foreign key (program_id, module_id) references public.program_modules(program_id, module_id) on delete cascade
);

create index if not exists program_modules_module_idx on public.program_modules(module_id);
create index if not exists program_lessons_module_idx on public.program_lessons(module_id);

alter table public.program_modules enable row level security;
alter table public.program_lessons enable row level security;

drop policy if exists program_modules_public_or_staff on public.program_modules;
create policy program_modules_public_or_staff on public.program_modules for select to anon, authenticated using (
  exists (select 1 from public.certificate_programs p where p.id = program_id and p.status = 'published')
  or public.niu_is_academic_staff()
);
drop policy if exists program_modules_staff_manage on public.program_modules;
create policy program_modules_staff_manage on public.program_modules for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());

drop policy if exists program_lessons_public_or_staff on public.program_lessons;
create policy program_lessons_public_or_staff on public.program_lessons for select to anon, authenticated using (
  exists (select 1 from public.certificate_programs p where p.id = program_id and p.status = 'published')
  or public.niu_is_academic_staff()
);
drop policy if exists program_lessons_staff_manage on public.program_lessons;
create policy program_lessons_staff_manage on public.program_lessons for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());

-- Backfill explicit scope from the existing programme-course relationships.
insert into public.program_modules(program_id, module_id, position, is_required)
select distinct pc.program_id, m.id, m.position, true
from public.program_courses pc
join public.course_modules m on m.course_id = pc.course_id
on conflict (program_id, module_id) do nothing;

insert into public.program_lessons(program_id, module_id, lesson_id, position, is_required)
select distinct pm.program_id, l.module_id, l.id, l.position, l.is_required
from public.program_modules pm
join public.lessons l on l.module_id = pm.module_id
on conflict (program_id, lesson_id) do nothing;

-- NIU-IT-CDL is intentionally a minimal package. Detach only the known legacy
-- Computer Fundamentals relationship and all non-target module/lesson links;
-- the course/module/lesson rows themselves remain intact for history and reuse.
do $niu_minimal_scope$
declare
  target_program uuid;
  target_course uuid;
  target_module uuid;
  target_lesson uuid;
begin
  select id into target_program from public.certificate_programs where code = 'NIU-IT-CDL' limit 1;
  select id into target_course from public.courses where title = 'Internet & Digital Skills' limit 1;
  select id into target_module from public.course_modules where course_id = target_course and title = 'Internet Fundamentals' order by status = 'approved' desc, position limit 1;
  select id into target_lesson from public.lessons where module_id = target_module and title = 'Understanding the Internet' order by status = 'approved' desc, position limit 1;
  if target_program is not null and target_course is not null and target_module is not null and target_lesson is not null then
    delete from public.program_lessons where program_id = target_program and lesson_id <> target_lesson;
    delete from public.program_modules where program_id = target_program and module_id <> target_module;
    delete from public.program_courses where program_id = target_program and course_id <> target_course;
    insert into public.program_modules(program_id, module_id, position, is_required)
    values (target_program, target_module, 0, true)
    on conflict (program_id, module_id) do update set position = excluded.position, is_required = true;
    insert into public.program_lessons(program_id, module_id, lesson_id, position, is_required)
    values (target_program, target_module, target_lesson, 0, true)
    on conflict (program_id, lesson_id) do update set module_id = excluded.module_id, position = excluded.position, is_required = true;
    insert into public.program_courses(program_id, course_id, position, is_required)
    values (target_program, target_course, 0, true)
    on conflict (program_id, course_id) do update set position = excluded.position, is_required = true;
  end if;
end;
$niu_minimal_scope$;

create or replace function public.niu_programme_bundle_readiness(target_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $niu_readiness$
declare
  course_total integer;
  approved_course_total integer;
  module_total integer;
  approved_module_total integer;
  required_lesson_total integer;
  approved_required_lesson_total integer;
  required_material_total integer;
  governed_assessment_total integer;
  ready_governed_assessment_total integer;
  assessment_required boolean;
  certificate_template_valid boolean;
  program_record public.certificate_programs;
begin
  if auth.uid() is null or not public.niu_is_academic_staff() then
    raise exception 'Academic staff authorization is required';
  end if;
  select * into program_record from public.certificate_programs where id = target_program_id;
  if not found then raise exception 'Certificate programme not found'; end if;

  assessment_required := coalesce((program_record.completion_requirements->>'assessment_required')::boolean, false)
    or coalesce((program_record.completion_requirements->>'requires_assessment')::boolean, false)
    or coalesce((program_record.completion_requirements->>'final_examination_required')::boolean, false);
  certificate_template_valid := program_record.award_type = 'certificate'
    and nullif(btrim(coalesce(program_record.certificate_template_key, '')), '') is not null;

  select count(*), count(*) filter (where c.status in ('approved', 'published'))
    into course_total, approved_course_total
    from public.program_courses pc
    join public.courses c on c.id = pc.course_id
   where pc.program_id = target_program_id and pc.is_required;

  select count(*), count(*) filter (where m.status in ('approved', 'published'))
    into module_total, approved_module_total
    from public.program_modules pm
    join public.course_modules m on m.id = pm.module_id
   where pm.program_id = target_program_id and pm.is_required;

  select count(*), count(*) filter (where l.status in ('approved', 'published'))
    into required_lesson_total, approved_required_lesson_total
    from public.program_lessons pl
    join public.lessons l on l.id = pl.lesson_id and l.module_id = pl.module_id
   where pl.program_id = target_program_id and pl.is_required;

  select count(distinct l.id)
    into required_material_total
    from public.program_lessons pl
    join public.lessons l on l.id = pl.lesson_id and l.module_id = pl.module_id
    join public.lesson_content_items lci on lci.lesson_id = l.id
   where pl.program_id = target_program_id and pl.is_required and l.is_required;

  select count(*) into governed_assessment_total
    from public.program_courses pc
    join public.assessments a on a.course_id = pc.course_id
   where pc.program_id = target_program_id and pc.is_required and a.governed_workflow;

  select count(*) into ready_governed_assessment_total
    from public.program_courses pc
    join public.assessments a on a.course_id = pc.course_id
   where pc.program_id = target_program_id and pc.is_required and a.governed_workflow
     and a.status in ('approved', 'published')
     and a.passing_score > 0 and a.passing_score <= 100
     and a.time_limit_minutes is not null and a.time_limit_minutes > 0
     and a.attempt_limit is not null and a.attempt_limit > 0
     and jsonb_typeof(coalesce(a.required_completion_rules, '{}'::jsonb)) = 'object'
     and exists (select 1 from jsonb_each(coalesce(a.required_completion_rules, '{}'::jsonb)) limit 1)
     and exists (select 1 from public.assessment_questions aq join public.questions q on q.id = aq.question_id where aq.assessment_id = a.id and q.approval_status in ('approved', 'published'))
     and not exists (select 1 from public.assessment_questions aq join public.questions q on q.id = aq.question_id where aq.assessment_id = a.id and q.approval_status not in ('approved', 'published'));

  return jsonb_build_object(
    'program_id', program_record.id,
    'program_status', program_record.status,
    'certificate_template_valid', certificate_template_valid,
    'assessment_required', assessment_required,
    'courses', course_total,
    'approved_courses', approved_course_total,
    'modules', module_total,
    'approved_modules', approved_module_total,
    'required_lessons', required_lesson_total,
    'approved_required_lessons', approved_required_lesson_total,
    'required_lessons_with_material', required_material_total,
    'governed_assessments', governed_assessment_total,
    'ready_governed_assessments', ready_governed_assessment_total,
    'ready', certificate_template_valid
      and course_total > 0 and course_total = approved_course_total
      and module_total > 0 and module_total = approved_module_total
      and required_lesson_total > 0 and required_lesson_total = approved_required_lesson_total
      and required_lesson_total = required_material_total
      and (not assessment_required or (governed_assessment_total > 0 and governed_assessment_total = ready_governed_assessment_total))
  );
end;
$niu_readiness$;

create or replace function public.niu_publish_programme_bundle(target_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $niu_publish$
declare
  readiness jsonb;
begin
  if auth.uid() is null or not public.niu_is_administrator() then raise exception 'Administrator authorization is required'; end if;
  select public.niu_programme_bundle_readiness(target_program_id) into readiness;
  if coalesce(readiness ->> 'program_status', '') <> 'approved' then raise exception 'The certificate programme must be approved before its complete bundle can be published'; end if;
  if not coalesce((readiness ->> 'ready')::boolean, false) then raise exception 'This programme package is not ready. Complete and approve the selected package records first.'; end if;
  update public.certificate_programs set status = 'published', published_at = now(), updated_at = now() where id = target_program_id and award_type = 'certificate';
  if not found then raise exception 'Only certificate programmes may be published'; end if;
  update public.courses set status = 'published', published_at = coalesce(published_at, now()), updated_at = now() where id in (select course_id from public.program_courses where program_id = target_program_id) and status = 'approved';
  update public.course_modules set status = 'published' where id in (select module_id from public.program_modules where program_id = target_program_id) and status = 'approved';
  update public.lessons set status = 'published' where id in (select lesson_id from public.program_lessons where program_id = target_program_id) and status = 'approved';
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata) values (auth.uid(), 'programme_bundle_published', 'certificate_program', target_program_id, readiness);
  return readiness || jsonb_build_object('published', true);
end;
$niu_publish$;

revoke all on function public.niu_programme_bundle_readiness(uuid) from public, anon;
revoke all on function public.niu_publish_programme_bundle(uuid) from public, anon;
grant execute on function public.niu_programme_bundle_readiness(uuid) to authenticated;
grant execute on function public.niu_publish_programme_bundle(uuid) to authenticated;
