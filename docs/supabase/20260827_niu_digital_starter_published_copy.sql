-- Correct wording that was appropriate while the starter structure was draft,
-- but is misleading after its controlled certificate-only publication.

update public.courses
set description = 'A certificate-only course that develops responsible digital practice, inclusive collaboration, evidence-informed opportunity thinking, and remote-work project planning.',
    updated_at = now()
where slug = 'digital-foundations-enterprise-remote-work'
  and status = 'published';

update public.course_modules
set description = case position
  when 0 then 'A foundation-level module for safe and inclusive access to digital tools, credible information, and productive study habits.'
  when 1 then 'A developing-level module for responsible communication, shared work, and participation in remote teams.'
  when 2 then 'An applied-level module for identifying needs, evaluating an idea, and planning practical value creation.'
  when 3 then 'A capstone-level module for bringing digital, collaboration, and entrepreneurship learning together in a planned deliverable.'
  else description
end
where course_id = (select id from public.courses where slug = 'digital-foundations-enterprise-remote-work' limit 1)
  and status = 'published'
  and position between 0 and 3;
