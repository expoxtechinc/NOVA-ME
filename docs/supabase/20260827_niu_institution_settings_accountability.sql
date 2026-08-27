-- Institution settings are singleton, certificate-only configuration governed by an administrator audit trail.
create unique index if not exists niu_institution_settings_singleton on public.institution_settings ((true));

drop policy if exists institution_settings_admin on public.institution_settings;
create policy institution_settings_admin_read on public.institution_settings for select to authenticated using (public.niu_is_administrator());
create policy institution_settings_direct_insert_denied on public.institution_settings for insert to authenticated with check (false);
create policy institution_settings_direct_update_denied on public.institution_settings for update to authenticated using (false) with check (false);
create policy institution_settings_direct_delete_denied on public.institution_settings for delete to authenticated using (false);

create or replace function public.niu_save_institution_settings(
  target_settings_id uuid,
  target_institution_name text,
  target_abbreviation text,
  target_founder_and_president text,
  target_primary_color text,
  target_secondary_color text,
  target_official_address text,
  target_official_email text,
  target_official_phone text,
  target_application_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare saved_settings public.institution_settings;
begin
  if auth.uid() is null or not public.niu_is_administrator() then raise exception 'Administrator authorization is required'; end if;
  if char_length(trim(target_institution_name)) not between 3 and 255 then raise exception 'Institution name must contain between 3 and 255 characters'; end if;
  if trim(target_abbreviation) !~ '^[A-Za-z0-9]{2,20}$' then raise exception 'Institution abbreviation must contain 2 to 20 letters or numbers'; end if;
  if char_length(trim(target_founder_and_president)) not between 3 and 255 then raise exception 'Founder and President field must contain between 3 and 255 characters'; end if;
  if coalesce(target_application_url, '') <> '' and target_application_url !~ '^https://' then raise exception 'Application URL must use https'; end if;
  if coalesce(target_official_email, '') <> '' and target_official_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Official email is invalid'; end if;
  if target_settings_id is null then
    insert into public.institution_settings (institution_name, abbreviation, founder_and_president, primary_color, secondary_color, official_address, official_email, official_phone, application_url, updated_by)
    values (trim(target_institution_name), upper(trim(target_abbreviation)), trim(target_founder_and_president), nullif(trim(target_primary_color), ''), nullif(trim(target_secondary_color), ''), nullif(trim(target_official_address), ''), nullif(lower(trim(target_official_email)), ''), nullif(trim(target_official_phone), ''), nullif(trim(target_application_url), ''), auth.uid())
    returning * into saved_settings;
  else
    update public.institution_settings
    set institution_name = trim(target_institution_name), abbreviation = upper(trim(target_abbreviation)), founder_and_president = trim(target_founder_and_president), primary_color = nullif(trim(target_primary_color), ''), secondary_color = nullif(trim(target_secondary_color), ''), official_address = nullif(trim(target_official_address), ''), official_email = nullif(lower(trim(target_official_email)), ''), official_phone = nullif(trim(target_official_phone), ''), application_url = nullif(trim(target_application_url), ''), updated_at = now(), updated_by = auth.uid()
    where id = target_settings_id
    returning * into saved_settings;
    if not found then raise exception 'Institution settings record not found'; end if;
  end if;
  insert into public.audit_events (actor_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), 'institution_settings_saved', 'institution_settings', saved_settings.id, jsonb_build_object('abbreviation', saved_settings.abbreviation, 'award_scope', saved_settings.award_scope));
  return jsonb_build_object('id', saved_settings.id, 'award_scope', saved_settings.award_scope);
end;
$$;

revoke all on function public.niu_save_institution_settings(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.niu_save_institution_settings(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
