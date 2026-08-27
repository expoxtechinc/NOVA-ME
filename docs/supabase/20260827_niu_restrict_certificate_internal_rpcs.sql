-- Internal trigger functions must not be callable through the public REST RPC surface.
revoke all on function public.niu_course_enrollment_eligibility_trigger() from public;
revoke all on function public.niu_grade_release_eligibility_trigger() from public;
revoke all on function public.niu_recalculate_certificate_candidate(uuid, uuid) from public;
-- Supporting-document and candidate-review functions enforce staff authorization internally;
-- remove broad grants so only explicitly protected server sessions can invoke them.
revoke all on function public.niu_create_supporting_document(uuid, uuid, uuid, text, text, text) from public;
revoke all on function public.niu_issue_supporting_document(uuid) from public;
revoke all on function public.niu_review_certificate_candidate(uuid, text, text) from public;
