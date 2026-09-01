-- Add structured inline learning-note support without changing existing content records.
-- Existing rows keep their current values and remain valid.

alter table public.content_library_items
  add column if not exists inline_content text,
  add column if not exists content_format text not null default 'external',
  add column if not exists estimated_minutes integer not null default 0,
  add column if not exists points numeric(7,2) not null default 0,
  add column if not exists accessibility_description text,
  add column if not exists author_name text,
  add column if not exists source_reference text,
  add column if not exists revision_notes text;

alter table public.content_library_items
  drop constraint if exists content_library_items_content_format_check;
alter table public.content_library_items
  add constraint content_library_items_content_format_check
  check (content_format in ('external', 'markdown', 'plain_text', 'html'));

alter table public.content_library_items
  drop constraint if exists content_library_items_inline_content_check;
alter table public.content_library_items
  add constraint content_library_items_inline_content_check
  check (inline_content is null or char_length(inline_content) <= 500000);

alter table public.content_library_items
  drop constraint if exists content_library_items_estimated_minutes_check;
alter table public.content_library_items
  add constraint content_library_items_estimated_minutes_check
  check (estimated_minutes >= 0 and estimated_minutes <= 10000);

alter table public.content_library_items
  drop constraint if exists content_library_items_points_check;
alter table public.content_library_items
  add constraint content_library_items_points_check
  check (points >= 0 and points <= 100000);

create index if not exists niu_content_library_inline_format_idx
  on public.content_library_items(content_format);
