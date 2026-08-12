-- =====================================================================
-- 0048: Mark Actual material lines that came out of existing stock.
--
-- Material on a job is either bought for it or drawn from what the yard
-- already holds. Only the first kind has a purchase price; the second is
-- valued at what the stock item is carried at. Recording which is which
-- lets the Actual side be compared against the Quotation honestly --
-- otherwise a job that consumed remnants looks free.
--
-- `inventory_item_id` is the stock item the line was drawn from, and
-- `from_stock` is the flag the worksheet toggles. The flag is kept as its
-- own column rather than derived from the FK being non-null so a line can
-- be marked as stock before the exact item is chosen.
--
-- Quotation lines deliberately do NOT get these columns: what is quoted is
-- a price, independent of where the steel later comes from.
-- =====================================================================

alter table public.job_actual_materials
  add column if not exists inventory_item_id uuid
    references public.inventory_items(id) on delete set null,
  add column if not exists from_stock boolean not null default false;

comment on column public.job_actual_materials.from_stock is
  'True when this line was drawn from existing stock rather than bought for the job.';
comment on column public.job_actual_materials.inventory_item_id is
  'The stock item the line was drawn from, when from_stock is true.';

create index if not exists jam_inventory_item_idx
  on public.job_actual_materials (inventory_item_id);
