-- NIU course publication workflow has an explicit approved stage between review
-- and published. Add the omitted enum value without changing any existing rows.

alter type public.course_status add value if not exists 'approved' after 'review';
