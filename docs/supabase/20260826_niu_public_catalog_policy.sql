-- Public catalogue reads must not invoke authenticated-only staff helper functions.
drop policy if exists certificate_programs_public_or_staff on public.certificate_programs;
create policy certificate_programs_public_read on public.certificate_programs
  for select to anon, authenticated
  using (status = 'published');
create policy certificate_programs_staff_read on public.certificate_programs
  for select to authenticated
  using (public.niu_is_academic_staff());
