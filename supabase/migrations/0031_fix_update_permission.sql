-- =====================================================================
-- 0031: Restore UPDATE and DELETE on the masked tables.
--
-- jobs, projects and inventory_items hide their money columns by revoking
-- SELECT from `authenticated` and exposing a definer view instead. That
-- works for reads, but Postgres also requires SELECT privilege on every
-- column named in a WHERE clause — so
--
--     update public.jobs set project_id = $1 where id = $2
--
-- failed with "permission denied for table jobs" for EVERY tier, including
-- administrators. Attaching a job to a project, deleting a job, editing a
-- project, soft-deleting anything, and every other filtered write on these
-- three tables was blocked.
--
-- The fix grants SELECT on the non-financial columns only. The money
-- columns stay ungranted, so Tier 1 still cannot read them from the base
-- table and the masking views remain the only way to see them at all.
-- `select *` on these tables now fails for everyone, which is intended:
-- the app reads jobs_view / projects_view / inventory_items_view.
--
-- Financial columns deliberately excluded:
--   jobs            - charge_to_site, quote_before_margin, margin,
--                     final_quote, actual_cost, profit_loss, pl_percentage
--   projects        - contract_value
--   inventory_items - unit_cost
-- =====================================================================

grant select (
  id, job_code, code_tail, company_job_code, quotation_ref, status, site_id,
  description, unit, qty, start_date, completion_date, requisition_no,
  lpo_ref, inbound_outpass, exit_outpass, comments, created_by, created_at,
  updated_at, deleted_at, project_id
) on public.jobs to authenticated;

grant select (
  id, client_id, site_id, name, project_code, status, start_date,
  target_completion, actual_completion, notes, created_by, created_at,
  updated_at, deleted_at
) on public.projects to authenticated;

grant select (
  id, item_code, item_type, description, material_grade, dimensions, unit,
  quantity_on_hand, reorder_threshold, warehouse_location, parent_item_id,
  source_job_id, active, created_by, created_at, updated_at
) on public.inventory_items to authenticated;

revoke all on public.jobs            from anon;
revoke all on public.projects        from anon;
revoke all on public.inventory_items from anon;
