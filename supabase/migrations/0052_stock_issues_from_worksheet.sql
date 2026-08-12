-- =====================================================================
-- 0052: Tie "In Stock" on the Actual worksheet to the stock ledger
--       (Changes II, item 5).
--
-- 0048 added from_stock/inventory_item_id so an Actual material line could
-- record that it came off the shelf and be costed at what that item is
-- carried at. It stopped there: no movement was written and on-hand never
-- moved, so the two halves of the app disagreed about what was in the yard.
--
-- A stock-drawn line now raises an `issue` movement, which the existing
-- t10_apply_movement trigger folds into quantity_on_hand.
--
-- The one hazard is duplication. replaceJobLines deletes and re-upserts a
-- section on every save, so posting blindly would issue the same steel again
-- on each keystroke-save. The movement is therefore keyed to the worksheet
-- line: one movement per line, enforced by a unique index, so a re-save
-- updates in place. Line ids are stable across saves -- replaceJobLines
-- preserves an existing id and only mints one for genuinely new rows.
--
-- Deleting the worksheet line cascades the movement away, and because
-- recompute_inventory_on_hand re-sums the whole ledger (rather than applying
-- a delta) and the trigger fires on DELETE too, on-hand corrects itself
-- automatically. Verified before relying on it.
--
-- Sign convention, unchanged: qty is signed, issues are negative.
-- =====================================================================

alter table public.inventory_movements
  add column if not exists job_actual_material_id uuid
    references public.job_actual_materials(id) on delete cascade;

comment on column public.inventory_movements.job_actual_material_id is
  'The Actual worksheet line that raised this issue, when it came from the worksheet rather than being recorded by hand. Unique: one movement per line.';

-- One movement per worksheet line, so a re-save updates instead of stacking.
--
-- Deliberately NOT a partial index. ON CONFLICT can only use an index whose
-- predicate it can infer, and PostgREST emits a bare `on conflict (col)` with
-- no WHERE clause -- so a `where job_actual_material_id is not null` variant
-- compiles fine and then fails every upsert at runtime with "no unique or
-- exclusion constraint matching the ON CONFLICT specification". A plain unique
-- index is safe here anyway: Postgres treats NULLs as distinct by default, so
-- hand-recorded movements (which have no line) never collide with each other.
create unique index if not exists invm_actual_material_uniq
  on public.inventory_movements (job_actual_material_id);

create index if not exists invm_actual_material_lookup
  on public.inventory_movements (job_actual_material_id);

-- New columns do not inherit a table's existing column grants.
grant insert (job_actual_material_id), update (job_actual_material_id)
  on public.inventory_movements to authenticated;
