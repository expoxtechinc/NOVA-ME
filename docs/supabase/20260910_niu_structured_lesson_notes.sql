-- NIU structured lesson notes: additive compatibility update.
-- Existing external, Markdown, plain-text, and HTML records remain valid.
-- Structured JSON is sanitized in the client before persistence and rendered as text/safe blocks only.

alter table public.content_library_items
  drop constraint if exists content_library_items_content_format_check;

alter table public.content_library_items
  add constraint content_library_items_content_format_check
  check (content_format in ('external', 'markdown', 'plain_text', 'html', 'structured_json'));

create index if not exists content_library_items_structured_notes_idx
  on public.content_library_items(content_format)
  where content_format = 'structured_json';

comment on column public.content_library_items.inline_content is
  'Sanitized inline content. structured_json values use the NIU LessonDocument v1 schema.';
