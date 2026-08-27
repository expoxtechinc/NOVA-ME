-- Future Course Studio programme governance. Existing programmes remain outside this stricter workflow.
alter table public.certificate_programs add column if not exists governed_workflow boolean not null default false;

drop trigger if exists niu_validate_future_programme_status on public.certificate_programs;
create trigger niu_validate_future_programme_status before insert or update on public.certificate_programs for each row execute function public.niu_validate_future_governed_status('status');

drop trigger if exists niu_audit_certificate_programs on public.certificate_programs;
create trigger niu_audit_certificate_programs after insert or update or delete on public.certificate_programs for each row execute function public.niu_capture_audit_event();
