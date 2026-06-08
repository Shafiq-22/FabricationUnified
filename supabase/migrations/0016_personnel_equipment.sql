-- =====================================================================
-- 0016: Personnel & Equipment Record module
--   personnel + equipment master lists, daily timesheet entries, and daily
--   equipment usage status codes. Two global timesheet rates in app_config.
-- =====================================================================

insert into public.app_config(key, value) values
  ('timesheet_normal_rate', '30'),
  ('timesheet_ot_rate', '45')
on conflict (key) do nothing;

-- ---- master lists --------------------------------------------------
create table public.personnel (
  id         uuid primary key default gen_random_uuid(),
  ho_no      text,
  name       text not null,
  trade      text,
  active     boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table public.equipment (
  id           uuid primary key default gen_random_uuid(),
  sixco_no     text,
  device_group text,
  machine      text not null,
  make         text,
  type         text,
  bare_rate    numeric(12,2),   -- "B" daily rate (AED)
  driver_rate  numeric(12,2),   -- "D" daily rate (AED)
  active       boolean not null default true,
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now()
);

-- ---- daily records -------------------------------------------------
create table public.timesheet_entries (
  id              uuid primary key default gen_random_uuid(),
  personnel_id    uuid not null references public.personnel(id) on delete cascade,
  entry_date      date not null,
  begin_time      text,
  end_time        text,
  normal_hours    numeric(6,2),
  ot_hours        numeric(6,2),
  site            text,
  job_description text,
  job_ref         text,
  created_by      uuid references public.users(id),
  created_at      timestamptz not null default now(),
  unique (personnel_id, entry_date)
);
create index ts_date_idx on public.timesheet_entries(entry_date);
create index ts_personnel_idx on public.timesheet_entries(personnel_id);

create table public.equipment_usage (
  id           uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  usage_date   date not null,
  status_code  text not null
    check (status_code in ('ON','OFF','R','P','N','F','S','B','A','T','E','L')),
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now(),
  unique (equipment_id, usage_date)
);
create index eu_date_idx on public.equipment_usage(usage_date);
create index eu_equipment_idx on public.equipment_usage(equipment_id);

-- ---- RLS (tier >= 2 manage; tier 3 deletes master records) ---------
alter table public.personnel enable row level security;
create policy pers_sel on public.personnel for select to authenticated using (public.auth_user_tier() >= 2);
create policy pers_ins on public.personnel for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy pers_upd on public.personnel for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy pers_del on public.personnel for delete to authenticated using (public.auth_is_admin());

alter table public.equipment enable row level security;
create policy equ_sel on public.equipment for select to authenticated using (public.auth_user_tier() >= 2);
create policy equ_ins on public.equipment for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy equ_upd on public.equipment for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy equ_del on public.equipment for delete to authenticated using (public.auth_is_admin());

alter table public.timesheet_entries enable row level security;
create policy tse_sel on public.timesheet_entries for select to authenticated using (public.auth_user_tier() >= 2);
create policy tse_ins on public.timesheet_entries for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy tse_upd on public.timesheet_entries for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy tse_del on public.timesheet_entries for delete to authenticated using (public.auth_user_tier() >= 2);

alter table public.equipment_usage enable row level security;
create policy eu_sel on public.equipment_usage for select to authenticated using (public.auth_user_tier() >= 2);
create policy eu_ins on public.equipment_usage for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy eu_upd on public.equipment_usage for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy eu_del on public.equipment_usage for delete to authenticated using (public.auth_user_tier() >= 2);

-- ---- audit + grants ------------------------------------------------
create trigger z_audit after insert or update or delete on public.personnel
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.equipment
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.timesheet_entries
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.equipment_usage
  for each row execute function public.audit_trigger();

grant select, insert, update, delete on public.personnel to authenticated;
grant select, insert, update, delete on public.equipment to authenticated;
grant select, insert, update, delete on public.timesheet_entries to authenticated;
grant select, insert, update, delete on public.equipment_usage to authenticated;
revoke all on public.personnel from anon;
revoke all on public.equipment from anon;
revoke all on public.timesheet_entries from anon;
revoke all on public.equipment_usage from anon;
