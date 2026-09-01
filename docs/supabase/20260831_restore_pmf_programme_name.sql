-- Restore the affected programme label without deleting or rewriting historical records.
-- The stable programme code scopes this repair to exactly one certificate programme.
update public.certificate_programs
   set name = 'Project Management Foundations: CAPM Preparation'
 where code = 'PMF-CAPM-101'
   and name = 'Project Management Fundamentals';
