-- Nova International University: certificate-only institutional foundation.
-- This migration is additive and intentionally contains no degree-enrollment tables.

create extension if not exists pgcrypto;

create table if not exists public.institution_settings (
  id uuid primary key default gen_random_uuid(),
  institution_name text not null default 'Nova International University',
  abbreviation text not null default 'NIU',
  founder_and_president text not null default 'Akin S. Sokpah',
  award_scope text not null default 'certificate_only' check (award_scope = 'certificate_only'),
  primary_color text,
  secondary_color text,
  logo_path text,
  seal_path text,
  signature_path text,
  official_address text,
  official_email text,
  official_phone text,
  application_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{2,24}$'),
  name text not null check (char_length(name) between 3 and 160),
  description text,
  image_path text,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z0-9-]{2,24}$'),
  name text not null check (char_length(name) between 3 and 160),
  description text,
  image_path text,
  head_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists public.faculty_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  biography text,
  qualifications text,
  profile_image_path text,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.certificate_programs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z0-9-]{2,32}$'),
  name text not null check (char_length(name) between 3 and 255),
  award_type text not null default 'certificate' check (award_type = 'certificate'),
  description text not null check (char_length(description) between 30 and 10000),
  objectives jsonb not null default '[]'::jsonb,
  learning_outcomes jsonb not null default '[]'::jsonb,
  duration_hours integer not null default 0 check (duration_hours >= 0),
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  required_score numeric(5,2) not null default 70 check (required_score >= 0 and required_score <= 100),
  completion_requirements jsonb not null default '{}'::jsonb,
  image_path text,
  certificate_template_key text,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'suspended', 'archived')),
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_courses (
  program_id uuid not null references public.certificate_programs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  position integer not null check (position >= 0),
  is_required boolean not null default true,
  primary key (program_id, course_id),
  unique (program_id, position)
);

create table if not exists public.course_prerequisites (
  course_id uuid not null references public.courses(id) on delete cascade,
  prerequisite_course_id uuid not null references public.courses(id) on delete restrict,
  primary key (course_id, prerequisite_course_id),
  check (course_id <> prerequisite_course_id)
);

create table if not exists public.course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived')),
  change_summary text not null check (char_length(change_summary) between 3 and 2000),
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (course_id, version_number)
);

create table if not exists public.content_review_comments (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('program', 'course', 'module', 'lesson', 'assessment')),
  subject_id uuid not null,
  body text not null check (char_length(body) between 2 and 10000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.question_banks (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete set null,
  title text not null check (char_length(title) between 3 and 255),
  description text,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_bank_id uuid not null references public.question_banks(id) on delete cascade,
  question_type text not null check (question_type in ('multiple_choice', 'true_false', 'matching', 'ordering', 'fill_blank', 'short_answer', 'essay', 'scenario')),
  prompt text not null check (char_length(prompt) between 2 and 20000),
  choices jsonb not null default '[]'::jsonb,
  answer_key jsonb not null default '{}'::jsonb,
  explanation text,
  difficulty text not null default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  category text,
  points numeric(7,2) not null default 1 check (points >= 0),
  requires_manual_grading boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.course_modules(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 255),
  assessment_type text not null check (assessment_type in ('quiz', 'module_test', 'final_assessment', 'exam', 'knowledge_check')),
  instructions text,
  passing_score numeric(5,2) not null default 70 check (passing_score >= 0 and passing_score <= 100),
  attempt_limit integer check (attempt_limit is null or attempt_limit > 0),
  time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes > 0),
  randomize_questions boolean not null default true,
  randomize_answers boolean not null default true,
  weight numeric(5,2) not null default 0 check (weight >= 0 and weight <= 100),
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_questions (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position integer not null check (position >= 0),
  points_override numeric(7,2) check (points_override is null or points_override >= 0),
  primary key (assessment_id, question_id),
  unique (assessment_id, position)
);

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  activity_kind text not null check (activity_kind in ('lesson', 'video', 'document', 'flashcards', 'quiz', 'assignment', 'assessment')),
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  last_position_seconds integer check (last_position_seconds is null or last_position_seconds >= 0),
  last_page integer check (last_page is null or last_page >= 0),
  completed_at timestamptz,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id, activity_kind)
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  front text not null check (char_length(front) between 1 and 5000),
  back text not null check (char_length(back) between 1 and 5000),
  image_path text,
  explanation text,
  category text,
  position integer not null default 0 check (position >= 0)
);

create table if not exists public.flashcard_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  state text not null default 'review_needed' check (state in ('viewed', 'mastered', 'review_needed')),
  next_review_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, flashcard_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.course_modules(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 255),
  instructions text not null check (char_length(instructions) between 3 and 20000),
  attachment_path text,
  due_at timestamptz,
  points numeric(7,2) not null default 0 check (points >= 0),
  rubric jsonb not null default '[]'::jsonb,
  submission_limit integer check (submission_limit is null or submission_limit > 0),
  allow_resubmission boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_text text,
  submission_path text,
  attempt_number integer not null default 1 check (attempt_number > 0),
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  graded_by uuid references public.profiles(id) on delete set null,
  score numeric(7,2) check (score is null or score >= 0),
  feedback text,
  unique (assignment_id, user_id, attempt_number)
);

create table if not exists public.discussion_threads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 255),
  body text not null check (char_length(body) between 2 and 20000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'reported', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads(id) on delete cascade,
  body text not null check (char_length(body) between 2 and 20000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'reported', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  program_id uuid not null references public.certificate_programs(id) on delete restrict,
  status text not null default 'active' check (status in ('pending', 'active', 'completed', 'cancelled')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, program_id)
);

create table if not exists public.gradebook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  score numeric(7,2) not null check (score >= 0),
  points_available numeric(7,2) not null check (points_available > 0),
  grade_status text not null default 'released' check (grade_status in ('draft', 'released')),
  graded_by uuid references public.profiles(id) on delete set null,
  graded_at timestamptz,
  feedback text,
  created_at timestamptz not null default now(),
  check (assessment_id is not null or assignment_id is not null)
);

create table if not exists public.certificate_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  program_id uuid not null references public.certificate_programs(id) on delete restrict,
  eligibility_status text not null default 'ineligible' check (eligibility_status in ('ineligible', 'eligible', 'under_review', 'approved', 'rejected', 'issued')),
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, program_id)
);

create table if not exists public.credential_status_history (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  previous_status text,
  new_status text not null check (new_status in ('pending', 'active', 'revoked', 'superseded')),
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 255),
  body text not null check (char_length(body) between 3 and 20000),
  audience_type text not null check (audience_type in ('university', 'department', 'program', 'course')),
  audience_id uuid,
  publish_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at is null or publish_at is null or expires_at > publish_at)
);

create table if not exists public.academic_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 255),
  description text,
  event_type text not null check (event_type in ('enrollment', 'course', 'assessment', 'exam', 'event', 'holiday', 'certificate')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  audience_type text not null default 'university' check (audience_type in ('university', 'department', 'program', 'course')),
  audience_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 255),
  body text not null check (char_length(body) between 1 and 20000),
  notification_type text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (char_length(subject) between 3 and 255),
  body text not null check (char_length(body) between 3 and 20000),
  category text not null check (category in ('technical', 'academic', 'administrative', 'other')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 255),
  body text not null check (char_length(body) between 30 and 50000),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  authored_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_role_assignments (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  institutional_role text not null check (institutional_role in ('registrar', 'academic_director', 'content_manager', 'faculty_manager', 'examiner', 'student_support')),
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (profile_id, institutional_role)
);

create table if not exists public.role_permissions (
  institutional_role text not null,
  permission_key text not null check (permission_key ~ '^[a-z0-9_.-]+$'),
  created_at timestamptz not null default now(),
  primary key (institutional_role, permission_key)
);

alter table public.certificates add column if not exists program_id uuid references public.certificate_programs(id) on delete set null;
alter table public.certificates add column if not exists credential_number text;
alter table public.certificates add column if not exists credential_title text;
alter table public.certificates add column if not exists status text not null default 'pending';
alter table public.certificates add column if not exists approved_at timestamptz;
alter table public.certificates add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.certificates add column if not exists revoked_by uuid references public.profiles(id) on delete set null;
alter table public.certificates add column if not exists revocation_reason text;
alter table public.certificates add column if not exists public_display_name text;
alter table public.certificates add column if not exists share_recipient_name boolean not null default false;
alter table public.certificates add column if not exists learning_hours integer check (learning_hours is null or learning_hours >= 0);
alter table public.certificates add column if not exists qr_payload text;

create unique index if not exists certificates_credential_number_unique on public.certificates (credential_number) where credential_number is not null;
create index if not exists schools_status_idx on public.schools(status);
create index if not exists departments_school_idx on public.departments(school_id);
create index if not exists certificate_programs_department_status_idx on public.certificate_programs(department_id, status);
create index if not exists program_enrollments_user_status_idx on public.program_enrollments(user_id, status);
create index if not exists learning_progress_user_lesson_idx on public.learning_progress(user_id, lesson_id);
create index if not exists certificate_candidates_status_idx on public.certificate_candidates(eligibility_status);
create index if not exists credential_status_history_certificate_idx on public.credential_status_history(certificate_id, changed_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, read_at, created_at desc);
create index if not exists support_tickets_requester_status_idx on public.support_tickets(requester_id, status);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'certificates_credential_number_format') then
    alter table public.certificates add constraint certificates_credential_number_format check (credential_number is null or credential_number ~ '^NIU-CERT-[0-9]{4}-[0-9]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'certificates_status_allowed') then
    alter table public.certificates add constraint certificates_status_allowed check (status in ('pending', 'active', 'revoked', 'superseded'));
  end if;
end $$;

create sequence if not exists public.niu_credential_sequence start with 1;

create or replace function public.niu_is_academic_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'administrator', 'instructor')
  ) or exists (
    select 1
    from public.profile_role_assignments r
    where r.profile_id = auth.uid()
      and r.institutional_role in ('registrar', 'academic_director', 'content_manager', 'faculty_manager', 'examiner', 'student_support')
  );
$$;

create or replace function public.niu_is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin', 'administrator')
  );
$$;

create or replace function public.niu_next_credential_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_serial bigint;
begin
  next_serial := nextval('public.niu_credential_sequence');
  return format('NIU-CERT-%s-%s', extract(year from current_date)::integer, lpad(next_serial::text, 6, '0'));
end;
$$;

create or replace function public.niu_assign_credential_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.credential_number is null then
    new.credential_number := public.niu_next_credential_number();
  end if;
  if new.qr_payload is null then
    new.qr_payload := '/verify/' || new.credential_number;
  end if;
  return new;
end;
$$;

drop trigger if exists certificates_assign_credential_number on public.certificates;
create trigger certificates_assign_credential_number
before insert on public.certificates
for each row execute function public.niu_assign_credential_number();

create or replace function public.niu_record_credential_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.credential_status_history (certificate_id, previous_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.credential_status_history (certificate_id, previous_status, new_status, reason, changed_by)
    values (new.id, old.status, new.status, new.revocation_reason, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists certificates_record_status_history on public.certificates;
create trigger certificates_record_status_history
after insert or update of status on public.certificates
for each row execute function public.niu_record_credential_status();

create or replace function public.verify_niu_credential(lookup_credential text)
returns table (
  credential_number text,
  credential_title text,
  program_name text,
  recipient_name text,
  issued_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.credential_number,
    coalesce(c.credential_title, course.title) as credential_title,
    cp.name as program_name,
    case when c.share_recipient_name then c.public_display_name else null end as recipient_name,
    c.issued_at,
    c.status
  from public.certificates c
  left join public.courses course on course.id = c.course_id
  left join public.certificate_programs cp on cp.id = c.program_id
  where upper(c.credential_number) = upper(trim(lookup_credential))
    and c.status in ('active', 'revoked', 'superseded')
  limit 1;
$$;

create or replace function public.niu_record_learning_progress(
  target_lesson_id uuid,
  target_activity_kind text,
  reported_progress numeric,
  reported_position_seconds integer default null,
  reported_page integer default null
)
returns public.learning_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  progress_row public.learning_progress;
  valid_enrollment boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select exists (
    select 1
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    join public.enrollments e on e.course_id = m.course_id
    where l.id = target_lesson_id
      and e.user_id = auth.uid()
      and e.status in ('active', 'completed')
  ) into valid_enrollment;

  if not valid_enrollment then
    raise exception 'Enrollment is required for this activity';
  end if;

  if target_activity_kind not in ('lesson', 'video', 'document', 'flashcards', 'quiz', 'assignment', 'assessment') then
    raise exception 'Unsupported activity kind';
  end if;

  insert into public.learning_progress (
    user_id, lesson_id, activity_kind, progress_percent, last_position_seconds, last_page,
    completed_at, verified_at, updated_at
  ) values (
    auth.uid(), target_lesson_id, target_activity_kind,
    greatest(0, least(reported_progress, 100)), reported_position_seconds, reported_page,
    case when reported_progress >= 100 then now() else null end,
    now(), now()
  )
  on conflict (user_id, lesson_id, activity_kind) do update
  set progress_percent = greatest(public.learning_progress.progress_percent, excluded.progress_percent),
      last_position_seconds = greatest(coalesce(public.learning_progress.last_position_seconds, 0), coalesce(excluded.last_position_seconds, 0)),
      last_page = greatest(coalesce(public.learning_progress.last_page, 0), coalesce(excluded.last_page, 0)),
      completed_at = coalesce(public.learning_progress.completed_at, excluded.completed_at),
      verified_at = now(),
      updated_at = now()
  returning * into progress_row;

  return progress_row;
end;
$$;

alter table public.institution_settings enable row level security;
alter table public.schools enable row level security;
alter table public.departments enable row level security;
alter table public.faculty_profiles enable row level security;
alter table public.certificate_programs enable row level security;
alter table public.program_courses enable row level security;
alter table public.course_prerequisites enable row level security;
alter table public.course_versions enable row level security;
alter table public.content_review_comments enable row level security;
alter table public.question_banks enable row level security;
alter table public.questions enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.learning_progress enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_progress enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.discussion_threads enable row level security;
alter table public.discussion_replies enable row level security;
alter table public.program_enrollments enable row level security;
alter table public.gradebook_entries enable row level security;
alter table public.certificate_candidates enable row level security;
alter table public.credential_status_history enable row level security;
alter table public.announcements enable row level security;
alter table public.academic_calendar_events enable row level security;
alter table public.notifications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.policy_pages enable row level security;
alter table public.profile_role_assignments enable row level security;
alter table public.role_permissions enable row level security;

create policy institution_settings_admin on public.institution_settings for all to authenticated using (public.niu_is_administrator()) with check (public.niu_is_administrator());
create policy schools_public_or_staff on public.schools for select to anon, authenticated using (status = 'published' or public.niu_is_academic_staff());
create policy schools_staff_manage on public.schools for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy departments_public_or_staff on public.departments for select to anon, authenticated using (status = 'published' or public.niu_is_academic_staff());
create policy departments_staff_manage on public.departments for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy faculty_profiles_public_or_staff on public.faculty_profiles for select to anon, authenticated using (is_public or public.niu_is_academic_staff());
create policy faculty_profiles_staff_manage on public.faculty_profiles for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy certificate_programs_public_or_staff on public.certificate_programs for select to anon, authenticated using (status = 'published' or public.niu_is_academic_staff());
create policy certificate_programs_staff_manage on public.certificate_programs for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy program_courses_public_or_staff on public.program_courses for select to anon, authenticated using (exists (select 1 from public.certificate_programs p where p.id = program_id and p.status = 'published') or public.niu_is_academic_staff());
create policy program_courses_staff_manage on public.program_courses for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy course_prerequisites_staff_only on public.course_prerequisites for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy course_versions_staff_only on public.course_versions for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy review_comments_staff_only on public.content_review_comments for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy question_banks_staff_only on public.question_banks for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy questions_staff_only on public.questions for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy assessments_staff_only on public.assessments for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy assessment_questions_staff_only on public.assessment_questions for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy learning_progress_own_or_staff on public.learning_progress for select to authenticated using (user_id = auth.uid() or public.niu_is_academic_staff());
create policy learning_progress_no_direct_write on public.learning_progress for insert to authenticated with check (false);
create policy learning_progress_no_direct_update on public.learning_progress for update to authenticated using (false);
create policy flashcards_enrolled_or_staff on public.flashcards for select to authenticated using (public.niu_is_academic_staff() or exists (select 1 from public.lessons l join public.course_modules m on m.id = l.module_id join public.enrollments e on e.course_id = m.course_id where l.id = flashcards.lesson_id and e.user_id = auth.uid() and e.status in ('active', 'completed')));
create policy flashcards_staff_manage on public.flashcards for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy flashcard_progress_own_or_staff on public.flashcard_progress for select to authenticated using (user_id = auth.uid() or public.niu_is_academic_staff());
create policy flashcard_progress_write_own on public.flashcard_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assignments_enrolled_or_staff on public.assignments for select to authenticated using (public.niu_is_academic_staff() or exists (select 1 from public.enrollments e where e.course_id = assignments.course_id and e.user_id = auth.uid() and e.status in ('active', 'completed')));
create policy assignments_staff_manage on public.assignments for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy assignment_submissions_own_or_staff on public.assignment_submissions for select to authenticated using (user_id = auth.uid() or public.niu_is_academic_staff());
create policy assignment_submissions_write_own on public.assignment_submissions for insert to authenticated with check (user_id = auth.uid());
create policy discussions_read_enrolled_or_staff on public.discussion_threads for select to authenticated using (public.niu_is_academic_staff() or exists (select 1 from public.enrollments e where e.course_id = discussion_threads.course_id and e.user_id = auth.uid() and e.status in ('active', 'completed')));
create policy discussions_create_enrolled on public.discussion_threads for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.enrollments e where e.course_id = discussion_threads.course_id and e.user_id = auth.uid() and e.status in ('active', 'completed')));
create policy discussion_replies_read_enrolled_or_staff on public.discussion_replies for select to authenticated using (public.niu_is_academic_staff() or exists (select 1 from public.discussion_threads t join public.enrollments e on e.course_id = t.course_id where t.id = discussion_replies.thread_id and e.user_id = auth.uid() and e.status in ('active', 'completed')));
create policy discussion_replies_create_enrolled on public.discussion_replies for insert to authenticated with check (created_by = auth.uid());
create policy program_enrollments_own_or_staff on public.program_enrollments for select to authenticated using (user_id = auth.uid() or public.niu_is_academic_staff());
create policy program_enrollments_staff_manage on public.program_enrollments for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy gradebook_own_or_staff on public.gradebook_entries for select to authenticated using (user_id = auth.uid() or public.niu_is_academic_staff());
create policy gradebook_staff_manage on public.gradebook_entries for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy candidates_own_or_staff on public.certificate_candidates for select to authenticated using (user_id = auth.uid() or public.niu_is_academic_staff());
create policy candidates_staff_manage on public.certificate_candidates for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy credential_history_own_or_staff on public.credential_status_history for select to authenticated using (public.niu_is_academic_staff() or exists (select 1 from public.certificates c where c.id = credential_status_history.certificate_id and c.user_id = auth.uid()));
create policy credential_history_staff_manage on public.credential_status_history for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy announcements_public_current on public.announcements for select to anon, authenticated using (publish_at is not null and publish_at <= now() and (expires_at is null or expires_at > now()));
create policy announcements_staff_manage on public.announcements for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy calendar_public on public.academic_calendar_events for select to anon, authenticated using (true);
create policy calendar_staff_manage on public.academic_calendar_events for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_staff_manage on public.notifications for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy support_tickets_own_or_staff on public.support_tickets for select to authenticated using (requester_id = auth.uid() or public.niu_is_academic_staff());
create policy support_tickets_create_own on public.support_tickets for insert to authenticated with check (requester_id = auth.uid());
create policy support_tickets_staff_manage on public.support_tickets for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy policy_pages_public_published on public.policy_pages for select to anon, authenticated using (status = 'published' or public.niu_is_academic_staff());
create policy policy_pages_staff_manage on public.policy_pages for all to authenticated using (public.niu_is_academic_staff()) with check (public.niu_is_academic_staff());
create policy profile_roles_admin_manage on public.profile_role_assignments for all to authenticated using (public.niu_is_administrator()) with check (public.niu_is_administrator());
create policy profile_roles_own_read on public.profile_role_assignments for select to authenticated using (profile_id = auth.uid());
create policy role_permissions_admin_manage on public.role_permissions for all to authenticated using (public.niu_is_administrator()) with check (public.niu_is_administrator());
create policy role_permissions_authenticated_read on public.role_permissions for select to authenticated using (true);

grant execute on function public.verify_niu_credential(text) to anon, authenticated;
grant execute on function public.niu_record_learning_progress(uuid, text, numeric, integer, integer) to authenticated;
grant execute on function public.niu_is_academic_staff() to authenticated;
grant execute on function public.niu_is_administrator() to authenticated;
