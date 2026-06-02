-- =====================================================================
-- 0008_app_config: singleton-style key/value settings (company/department
-- names for PDF headers, etc.). Admin-writable, all-readable.
-- =====================================================================
create table public.app_config (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
create policy ac_sel on public.app_config for select to authenticated using (true);
create policy ac_admin_ins on public.app_config for insert to authenticated with check (public.auth_is_admin());
create policy ac_admin_upd on public.app_config for update to authenticated using (public.auth_is_admin()) with check (public.auth_is_admin());

create trigger z_audit after insert or update or delete on public.app_config
  for each row execute function public.audit_trigger();

grant select, insert, update, delete on public.app_config to authenticated;
revoke all on public.app_config from anon;

insert into public.app_config(key, value) values
  ('company_name', 'SIXCO'),
  ('department_name', 'BAF — Workshop Steel Fabrication')
on conflict (key) do nothing;
