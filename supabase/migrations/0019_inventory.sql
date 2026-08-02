-- =====================================================================
-- 0019: Inventory & remnants.
-- The movements ledger is the source of truth; inventory_items.quantity_on_hand
-- is derived from it by trigger (same derive-don't-trust approach as
-- recompute_job_financials). Stock levels are visible to Tier 1; money columns
-- are masked by inventory_items_view, mirroring the jobs/jobs_view arrangement.
-- =====================================================================

create table public.inventory_items (
  id                 uuid primary key default gen_random_uuid(),
  item_code          text,
  item_type          text not null default 'section'
                       check (item_type in ('plate','section','consumable','remnant')),
  description        text not null,
  material_grade     text,
  dimensions         text,
  unit               text default 'pcs',
  quantity_on_hand   numeric(14,3) not null default 0,   -- derived; do not write directly
  reorder_threshold  numeric(14,3),
  warehouse_location text,
  unit_cost          numeric(12,2),
  parent_item_id     uuid references public.inventory_items(id) on delete set null, -- remnant source
  source_job_id      uuid references public.jobs(id) on delete set null,            -- remnant origin
  active             boolean not null default true,
  created_by         uuid references public.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index inv_type_idx       on public.inventory_items(item_type);
create index inv_parent_idx     on public.inventory_items(parent_item_id);
create index inv_source_job_idx on public.inventory_items(source_job_id);
create unique index inv_code_uidx on public.inventory_items (lower(item_code)) where item_code is not null;

create table public.inventory_movements (
  id                uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type     text not null check (movement_type in ('receipt','issue','adjustment','remnant')),
  qty               numeric(14,3) not null,   -- signed: receipts/remnants +, issues -
  job_id            uuid references public.jobs(id) on delete set null,
  job_material_id   uuid references public.job_materials(id) on delete set null,
  note              text,
  moved_on          date not null default current_date,
  created_by        uuid references public.users(id),
  created_at        timestamptz not null default now()
);
create index invm_item_idx on public.inventory_movements(inventory_item_id);
create index invm_job_idx  on public.inventory_movements(job_id);
create index invm_date_idx on public.inventory_movements(moved_on desc);

-- ---- Derive on-hand from the ledger --------------------------------
create or replace function public.recompute_inventory_on_hand(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.inventory_items
     set quantity_on_hand = coalesce(
           (select sum(qty) from public.inventory_movements where inventory_item_id = p_item_id), 0),
         updated_at = now()
   where id = p_item_id;
end;
$$;

create or replace function public.tg_inventory_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.recompute_inventory_on_hand(new.inventory_item_id);
  end if;
  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and old.inventory_item_id is distinct from new.inventory_item_id) then
    perform public.recompute_inventory_on_hand(old.inventory_item_id);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger t10_apply_movement after insert or update or delete on public.inventory_movements
  for each row execute function public.tg_inventory_movement();

-- ---- RLS ------------------------------------------------------------
alter table public.inventory_items enable row level security;
create policy inv_sel on public.inventory_items for select to authenticated using (public.auth_user_tier() >= 1);
create policy inv_ins on public.inventory_items for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy inv_upd on public.inventory_items for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy inv_del on public.inventory_items for delete to authenticated using (public.auth_is_admin());

alter table public.inventory_movements enable row level security;
create policy invm_sel on public.inventory_movements for select to authenticated using (public.auth_user_tier() >= 2);
create policy invm_ins on public.inventory_movements for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy invm_upd on public.inventory_movements for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy invm_del on public.inventory_movements for delete to authenticated using (public.auth_is_admin());

create trigger z_audit after insert or update or delete on public.inventory_items
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.inventory_movements
  for each row execute function public.audit_trigger();

-- ---- Masking view: the only read path for inventory -----------------
create or replace view public.inventory_items_view with (security_invoker = false) as
select
  i.id, i.item_code, i.item_type, i.description, i.material_grade, i.dimensions, i.unit,
  i.quantity_on_hand, i.reorder_threshold, i.warehouse_location,
  case when public.auth_user_tier() >= 2 then i.unit_cost end as unit_cost,
  case when public.auth_user_tier() >= 2
       then round(i.quantity_on_hand * coalesce(i.unit_cost, 0), 2) end as stock_value,
  i.parent_item_id, i.source_job_id, j.job_code as source_job_code,
  i.active, i.created_at, i.updated_at,
  (i.reorder_threshold is not null and i.quantity_on_hand <= i.reorder_threshold) as low_stock
from public.inventory_items i
left join public.jobs j on j.id = i.source_job_id;

create or replace view public.inventory_low_stock with (security_invoker = false) as
select * from public.inventory_items_view where active and low_stock;

-- ---- Grants ---------------------------------------------------------
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.inventory_movements to authenticated;
-- Reads go through the masking view so unit_cost cannot be pulled directly.
revoke select on public.inventory_items from authenticated;
grant select on public.inventory_items_view to authenticated;
grant select on public.inventory_low_stock  to authenticated;
revoke all on public.inventory_items      from anon;
revoke all on public.inventory_movements   from anon;
