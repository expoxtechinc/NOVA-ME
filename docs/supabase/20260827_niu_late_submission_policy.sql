-- Structured late-submission policy is attached to each assignment record.
alter table public.assignments add column if not exists late_submission_policy jsonb not null default '{"mode":"accept_with_flag","daily_penalty_percent":0,"grace_minutes":0}'::jsonb;
