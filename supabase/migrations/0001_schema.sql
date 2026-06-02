-- =====================================================================
-- 0001_schema: extensions + all tables (no functions/triggers/RLS yet)
-- BAF Workshop Steel Fabrication — Job Book
-- All money is numeric(12,2) AED. Date-only fields use `date`; audit uses timestamptz.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Config / core tables
-- ---------------------------------------------------------------------
create table public.roles_config (
  id           uuid primary key default gen_random_uuid(),
  tier         int  not null unique check (tier in (1, 2, 3)),
  display_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.sites (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  location   text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  email      text,
  role_tier  int  not null default 1 references public.roles_config(tier),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.labour_rates (
  id              uuid primary key default gen_random_uuid(),
  designation     text not null,
  rate_aed_per_hr numeric(12,2) not null,
  effective_from  date not null default current_date,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Jobs + worksheet detail
-- ---------------------------------------------------------------------
create table public.job_code_sequences (
  year_month text primary key,        -- 'YYYY-MM'
  last_seq   int not null default 0
);

create table public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  job_code            text unique,
  code_tail           text,           -- immutable 'SITE-MON-SEQ' segment
  company_job_code    text,
  quotation_ref       text,
  status              text not null default 'quotation'
                        check (status in ('quotation','in_progress','completed','delivered')),
  site_id             uuid references public.sites(id),
  description         text,
  unit                text,
  qty                 numeric(12,2),
  start_date          date,
  completion_date     date,
  charge_to_site      numeric(12,2),
  quote_before_margin numeric(12,2) not null default 0,
  margin              numeric(6,4)  not null default 0.15,
  final_quote         numeric(12,2),  -- computed by trigger
  actual_cost         numeric(12,2),
  profit_loss         numeric(12,2),  -- computed by trigger
  pl_percentage       numeric(8,4),   -- computed by trigger
  requisition_no      text,
  lpo_ref             text,
  inbound_outpass     text,
  exit_outpass        text,
  comments            text,           -- free-text notes (the realtime thread is job_comments)
  created_by          uuid references public.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index jobs_site_idx on public.jobs(site_id);
create index jobs_status_idx on public.jobs(status);
create index jobs_start_date_idx on public.jobs(start_date);

create table public.job_quote_materials (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  seq_no        int,
  material_name text,
  unit          text,
  qty           numeric(12,2),
  unit_cost     numeric(12,2),
  total_cost    numeric(12,2) generated always as (coalesce(qty,0) * coalesce(unit_cost,0)) stored
);
create index jqm_job_idx on public.job_quote_materials(job_id);

create table public.job_actual_materials (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  seq_no        int,
  material_name text,
  unit          text,
  qty           numeric(12,2),
  unit_cost     numeric(12,2),
  total_cost    numeric(12,2) generated always as (coalesce(qty,0) * coalesce(unit_cost,0)) stored
);
create index jam_job_idx on public.job_actual_materials(job_id);

create table public.job_quote_workforce (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.jobs(id) on delete cascade,
  seq_no         int,
  designation    text,
  qty            numeric(12,2),
  hrs_per_person numeric(12,2),
  date           date,
  total_hours    numeric(12,2) generated always as (coalesce(qty,0) * coalesce(hrs_per_person,0)) stored
);
create index jqw_job_idx on public.job_quote_workforce(job_id);

create table public.job_actual_workforce (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.jobs(id) on delete cascade,
  seq_no         int,
  designation    text,
  qty            numeric(12,2),
  hrs_per_person numeric(12,2),
  date           date,
  total_hours    numeric(12,2) generated always as (coalesce(qty,0) * coalesce(hrs_per_person,0)) stored
);
create index jaw_job_idx on public.job_actual_workforce(job_id);

create table public.job_quotation_summary (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  item_name  text,
  unit       text,
  qty        numeric(12,2),
  unit_cost  numeric(12,2),
  total_cost numeric(12,2) generated always as (coalesce(qty,0) * coalesce(unit_cost,0)) stored,
  seq_no     int
);
create index jqs_job_idx on public.job_quotation_summary(job_id);

create table public.job_actual_summary (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  item_name  text,
  unit       text,
  qty        numeric(12,2),
  unit_cost  numeric(12,2),
  total_cost numeric(12,2) generated always as (coalesce(qty,0) * coalesce(unit_cost,0)) stored,
  seq_no     int
);
create index jas_job_idx on public.job_actual_summary(job_id);

create table public.job_comments (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  user_id    uuid references public.users(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index jc_job_idx on public.job_comments(job_id);

-- ---------------------------------------------------------------------
-- Rough sheet / cut list
-- ---------------------------------------------------------------------
create table public.rough_sheet_items (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  seq_no       int,
  profile_type text,
  dimension    text,
  length_m     numeric(12,3),
  qty          numeric(12,2),
  total_length numeric(14,3) generated always as (coalesce(length_m,0) * coalesce(qty,0)) stored,
  order_qty    int generated always as (ceil(coalesce(length_m,0) * coalesce(qty,0) / 6.0)::int) stored
);
create index rsi_job_idx on public.rough_sheet_items(job_id);

create table public.cut_list_plates (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  seq_no        int,
  thickness_mm  numeric(8,2),
  plate_size    text,             -- '2x6' | '1.5x6' | 'custom'
  length_mm     numeric(12,2),
  width_mm      numeric(12,2),
  qty           numeric(12,2),
  total_area_m2 numeric(14,4) generated always as
                  ((coalesce(length_mm,0)/1000.0) * (coalesce(width_mm,0)/1000.0) * coalesce(qty,0)) stored
);
create index clp_job_idx on public.cut_list_plates(job_id);

-- ---------------------------------------------------------------------
-- Procurement / consumables / handover
-- ---------------------------------------------------------------------
create table public.consumables (
  id             uuid primary key default gen_random_uuid(),
  order_date     date,
  item_name      text,
  unit           text,
  qty            numeric(12,2),
  unit_price     numeric(12,2),
  total_price    numeric(12,2) generated always as (coalesce(qty,0) * coalesce(unit_price,0)) stored,
  pr_no          text,
  lpo_no         text,
  invoice_dn_no  text,
  delivery_date  date,
  supplier       text,
  month_year     text generated always as (
                   case when order_date is null then null
                   else lpad(extract(year from order_date)::text, 4, '0') || '-' ||
                        lpad(extract(month from order_date)::text, 2, '0') end) stored,
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index consumables_month_idx on public.consumables(month_year);

create table public.job_materials (
  id                   uuid primary key default gen_random_uuid(),
  request_date         date,
  order_date           date,
  job_id               uuid references public.jobs(id) on delete set null,
  item_name            text,
  unit                 text,
  qty                  numeric(12,2),
  unit_price           numeric(12,2),
  total_price          numeric(12,2) generated always as (coalesce(qty,0) * coalesce(unit_price,0)) stored,
  pr_no                text,
  lpo_no               text,
  invoice_dn_no        text,
  delivery_date        date,
  time_to_deliver_days int generated always as ((delivery_date - order_date)) stored,
  supplier             text,
  created_by           uuid references public.users(id),
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
create index jm_job_idx on public.job_materials(job_id);
create index jm_order_date_idx on public.job_materials(order_date);

create table public.handover_items (
  id                  uuid primary key default gen_random_uuid(),
  job_description     text,
  qty                 numeric(12,2),
  po_ref              text,
  supplier            text,
  remark              text,
  expected_completion date,
  type                text not null default 'active' check (type in ('active','forecasted')),
  site_id             uuid references public.sites(id),
  created_by          uuid references public.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index handover_type_idx on public.handover_items(type);

create table public.drawings (
  id           uuid primary key default gen_random_uuid(),
  handover_id  uuid references public.handover_items(id) on delete cascade,
  title        text,
  status       text,
  submitted_to text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index drawings_handover_idx on public.drawings(handover_id);

-- ---------------------------------------------------------------------
-- Audit log (append-only; written only by the audit trigger)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  action     text not null,
  table_name text not null,
  record_id  uuid,
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz not null default now()
);
create index audit_table_idx on public.audit_log(table_name, created_at desc);
