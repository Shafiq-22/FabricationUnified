-- =====================================================================
-- 0018: Suppliers master.
-- Additive only: existing free-text `supplier` columns are retained and kept
-- populated; the new supplier_id FK sits alongside them. historic_prices is
-- replaced with identical leading columns (+ supplier_id appended) so both
-- existing consumers keep working.
-- =====================================================================

create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  contact_email text,
  contact_phone text,
  category      text,          -- steel, consumables, paint, transport, ...
  active        boolean not null default true,
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now()
);
-- Case-insensitive uniqueness: prevents "ESAB" / "Esab " duplicates.
create unique index suppliers_name_uidx on public.suppliers (lower(name));

alter table public.job_materials add column supplier_id uuid references public.suppliers(id);
alter table public.consumables   add column supplier_id uuid references public.suppliers(id);
create index jm_supplier_idx   on public.job_materials(supplier_id);
create index cons_supplier_idx on public.consumables(supplier_id);

-- ---- Backfill from existing free text -------------------------------
-- Dedupe on lower(trim(...)) so no conflict against the unique index.
insert into public.suppliers (name)
select distinct on (lower(trim(supplier))) trim(supplier)
from (
  select supplier from public.job_materials where coalesce(trim(supplier), '') <> ''
  union all
  select supplier from public.consumables   where coalesce(trim(supplier), '') <> ''
) s
order by lower(trim(supplier)), trim(supplier);

update public.job_materials m
   set supplier_id = s.id
  from public.suppliers s
 where lower(trim(m.supplier)) = lower(s.name)
   and m.supplier_id is null;

update public.consumables c
   set supplier_id = s.id
  from public.suppliers s
 where lower(trim(c.supplier)) = lower(s.name)
   and c.supplier_id is null;

-- ---- RLS (cost-bearing context -> tier >= 2; admin deletes) ---------
alter table public.suppliers enable row level security;
create policy sup_sel on public.suppliers for select to authenticated using (public.auth_user_tier() >= 2);
create policy sup_ins on public.suppliers for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy sup_upd on public.suppliers for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy sup_del on public.suppliers for delete to authenticated using (public.auth_is_admin());

create trigger z_audit after insert or update or delete on public.suppliers
  for each row execute function public.audit_trigger();

grant select, insert, update, delete on public.suppliers to authenticated;
revoke all on public.suppliers from anon;

-- ---- historic_prices: group by supplier FK when present -------------
-- Leading columns are byte-identical to the previous definition; supplier_id
-- is appended (CREATE OR REPLACE permits trailing additions).
create or replace view public.historic_prices with (security_invoker = true) as
select
  lower(trim(m.item_name))                                              as item_key,
  max(m.item_name)                                                      as item_name,
  max(coalesce(s.name, trim(m.supplier)))                               as supplier,
  round(avg(m.unit_price), 2)                                           as avg_price,
  (array_agg(m.unit_price order by m.order_date desc nulls last))[1]    as last_price,
  max(m.order_date)                                                     as last_date,
  count(*)                                                              as order_count,
  (array_agg(m.supplier_id) filter (where m.supplier_id is not null))[1] as supplier_id
from public.job_materials m
left join public.suppliers s on s.id = m.supplier_id
where m.deleted_at is null and m.item_name is not null and m.unit_price is not null
group by lower(trim(m.item_name)), coalesce(m.supplier_id::text, lower(trim(m.supplier)));
