-- Repair: the UI persists the source and deterministic analysis in one governed insert.
-- Keep the job staff-only and disallow approval/publication states on initial insert.
drop policy if exists curriculum_imports_staff_insert on public.curriculum_imports;
create policy curriculum_imports_staff_insert on public.curriculum_imports for insert to authenticated
with check (
  public.niu_is_academic_staff()
  and created_by = auth.uid()
  and status in ('uploaded', 'analyzing', 'generated', 'validation_failed')
);
