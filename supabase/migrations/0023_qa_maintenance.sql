-- =====================================================================
-- 0023: QA (inspections + NCRs), welder qualifications, equipment maintenance.
-- Inspections/NCRs reference a job plus a free-text item_ref (mark/member no)
-- rather than a drawing_members table, which this app does not have.
-- =====================================================================

create table public.inspection_reports (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references public.jobs(id) on delete cascade,
  item_ref     text,                       -- member / mark number
  inspector_id uuid references public.personnel(id) on delete set null,
  result       text not null default 'pass' check (result in ('pass','fail','conditional')),
  notes        text,
  inspected_at timestamptz not null default now(),
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index insp_job_idx  on public.inspection_reports(job_id);
create index insp_date_idx on public.inspection_reports(inspected_at desc);

create table public.ncrs (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid references public.jobs(id) on delete cascade,
  project_id        uuid references public.projects(id) on delete set null,
  item_ref          text,
  title             text not null,
  description       text,
  root_cause        text,
  corrective_action text,
  severity          text default 'minor' check (severity in ('minor','major','critical')),
  status            text not null default 'open' check (status in ('open','in_progress','closed')),
  raised_by         uuid references public.users(id),
  raised_at         timestamptz not null default now(),
  closed_at         timestamptz,
  created_by        uuid references public.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index ncr_job_idx    on public.ncrs(job_id);
create index ncr_status_idx on public.ncrs(status);

create trigger t40_guard_soft_delete before update on public.inspection_reports
  for each row execute function public.guard_soft_delete();
create trigger t40_guard_soft_delete before update on public.ncrs
  for each row execute function public.guard_soft_delete();
create trigger t50_set_updated_at before update on public.ncrs
  for each row execute function public.set_updated_at();

-- ---- Welder qualifications (ISO 3834-2 traceability) ---------------
alter table public.personnel add column welder_qualification text;
alter table public.personnel add column qualification_expiry date;

-- ---- Equipment maintenance -----------------------------------------
alter table public.equipment add column status text not null default 'operational'
  check (status in ('operational','down','maintenance'));
alter table public.equipment add column last_service_date date;

create table public.maintenance_records (
  id               uuid primary key default gen_random_uuid(),
  equipment_id     uuid not null references public.equipment(id) on delete cascade,
  performed_by     uuid references public.personnel(id) on delete set null,
  maintenance_type text not null default 'scheduled'
                     check (maintenance_type in ('scheduled','breakdown','inspection','repair')),
  description      text,
  downtime_hours   numeric(8,2),
  cost             numeric(12,2),
  performed_on     date not null default current_date,
  created_by       uuid references public.users(id),
  created_at       timestamptz not null default now()
);
create index maint_equip_idx on public.maintenance_records(equipment_id);
create index maint_date_idx  on public.maintenance_records(performed_on desc);

-- Keep equipment.last_service_date in step with the newest record.
create or replace function public.tg_maintenance_touch_equipment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_equip uuid;
begin
  v_equip := coalesce(new.equipment_id, old.equipment_id);
  update public.equipment
     set last_service_date = (
           select max(performed_on) from public.maintenance_records where equipment_id = v_equip)
   where id = v_equip;
  return coalesce(new, old);
end;
$$;

create trigger t20_touch_equipment after insert or update or delete on public.maintenance_records
  for each row execute function public.tg_maintenance_touch_equipment();

-- ---- RLS ------------------------------------------------------------
alter table public.inspection_reports enable row level security;
create policy insp_sel on public.inspection_reports for select to authenticated using (public.auth_user_tier() >= 1 and deleted_at is null);
create policy insp_ins on public.inspection_reports for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy insp_upd on public.inspection_reports for update to authenticated
  using ((public.auth_user_tier() >= 2 and deleted_at is null) or public.auth_is_admin())
  with check (public.auth_user_tier() >= 2);
create policy insp_del on public.inspection_reports for delete to authenticated using (public.auth_is_admin());

alter table public.ncrs enable row level security;
create policy ncr_sel on public.ncrs for select to authenticated using (public.auth_user_tier() >= 1 and deleted_at is null);
create policy ncr_ins on public.ncrs for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy ncr_upd on public.ncrs for update to authenticated
  using ((public.auth_user_tier() >= 2 and deleted_at is null) or public.auth_is_admin())
  with check (public.auth_user_tier() >= 2);
create policy ncr_del on public.ncrs for delete to authenticated using (public.auth_is_admin());

alter table public.maintenance_records enable row level security;
create policy maint_sel on public.maintenance_records for select to authenticated using (public.auth_user_tier() >= 2);
create policy maint_ins on public.maintenance_records for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy maint_upd on public.maintenance_records for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy maint_del on public.maintenance_records for delete to authenticated using (public.auth_is_admin());

create trigger z_audit after insert or update or delete on public.inspection_reports
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.ncrs
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.maintenance_records
  for each row execute function public.audit_trigger();

grant select, insert, update, delete on public.inspection_reports  to authenticated;
grant select, insert, update, delete on public.ncrs                to authenticated;
grant select, insert, update, delete on public.maintenance_records to authenticated;
revoke all on public.inspection_reports  from anon;
revoke all on public.ncrs                from anon;
revoke all on public.maintenance_records from anon;
revoke execute on function public.tg_maintenance_touch_equipment() from public, anon, authenticated;
