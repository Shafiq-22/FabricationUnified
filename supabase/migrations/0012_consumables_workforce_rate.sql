-- =====================================================================
-- 0012: per-job consumables (quote + actual) + workforce hourly rate
-- =====================================================================
create table public.job_quote_consumables (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  seq_no     int,
  item_name  text,
  unit       text,
  qty        numeric(12,2),
  unit_cost  numeric(12,2),
  total_cost numeric(12,2) generated always as (coalesce(qty,0) * coalesce(unit_cost,0)) stored
);
create index jqc_job_idx on public.job_quote_consumables(job_id);

create table public.job_actual_consumables (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  seq_no     int,
  item_name  text,
  unit       text,
  qty        numeric(12,2),
  unit_cost  numeric(12,2),
  total_cost numeric(12,2) generated always as (coalesce(qty,0) * coalesce(unit_cost,0)) stored
);
create index jac_job_idx on public.job_actual_consumables(job_id);

-- Workforce lines now carry a snapshot hourly rate (prefilled from labour_rates).
alter table public.job_quote_workforce  add column rate_aed_per_hr numeric(12,2);
alter table public.job_actual_workforce add column rate_aed_per_hr numeric(12,2);

-- RLS (cost-bearing -> tier >= 2), mirroring the materials tables.
alter table public.job_quote_consumables enable row level security;
create policy jqc_sel on public.job_quote_consumables for select to authenticated using (public.auth_user_tier() >= 2);
create policy jqc_ins on public.job_quote_consumables for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy jqc_upd on public.job_quote_consumables for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy jqc_del on public.job_quote_consumables for delete to authenticated using (public.auth_user_tier() >= 2);

alter table public.job_actual_consumables enable row level security;
create policy jac_sel on public.job_actual_consumables for select to authenticated using (public.auth_user_tier() >= 2);
create policy jac_ins on public.job_actual_consumables for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy jac_upd on public.job_actual_consumables for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy jac_del on public.job_actual_consumables for delete to authenticated using (public.auth_user_tier() >= 2);

create trigger z_audit after insert or update or delete on public.job_quote_consumables
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.job_actual_consumables
  for each row execute function public.audit_trigger();

grant select, insert, update, delete on public.job_quote_consumables to authenticated;
grant select, insert, update, delete on public.job_actual_consumables to authenticated;
revoke all on public.job_quote_consumables from anon;
revoke all on public.job_actual_consumables from anon;
