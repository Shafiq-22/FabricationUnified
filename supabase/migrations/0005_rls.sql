-- =====================================================================
-- 0005_rls: enable RLS + policies + grants
-- Tiers: 1 Viewer (read-only, no financials), 2 Engineer, 3 Admin.
-- jobs has NO select policy: reads go through the definer view public.jobs_view.
-- =====================================================================

-- ---- sites ----------------------------------------------------------
alter table public.sites enable row level security;
create policy sites_select on public.sites for select to authenticated using (true);
create policy sites_admin_ins on public.sites for insert to authenticated with check (public.auth_is_admin());
create policy sites_admin_upd on public.sites for update to authenticated using (public.auth_is_admin()) with check (public.auth_is_admin());
create policy sites_admin_del on public.sites for delete to authenticated using (public.auth_is_admin());

-- ---- roles_config ---------------------------------------------------
alter table public.roles_config enable row level security;
create policy roles_select on public.roles_config for select to authenticated using (true);
create policy roles_admin_upd on public.roles_config for update to authenticated using (public.auth_is_admin()) with check (public.auth_is_admin());

-- ---- users ----------------------------------------------------------
alter table public.users enable row level security;
create policy users_select on public.users for select to authenticated using (true);
create policy users_admin_ins on public.users for insert to authenticated with check (public.auth_is_admin());
create policy users_admin_upd on public.users for update to authenticated using (public.auth_is_admin()) with check (public.auth_is_admin());
create policy users_admin_del on public.users for delete to authenticated using (public.auth_is_admin());

-- ---- labour_rates (financial) --------------------------------------
alter table public.labour_rates enable row level security;
create policy lr_select on public.labour_rates for select to authenticated using (public.auth_user_tier() >= 2);
create policy lr_admin_ins on public.labour_rates for insert to authenticated with check (public.auth_is_admin());
create policy lr_admin_upd on public.labour_rates for update to authenticated using (public.auth_is_admin()) with check (public.auth_is_admin());
create policy lr_admin_del on public.labour_rates for delete to authenticated using (public.auth_is_admin());

-- ---- jobs (write only; reads via jobs_view) ------------------------
alter table public.jobs enable row level security;
create policy jobs_ins on public.jobs for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy jobs_upd on public.jobs for update to authenticated
  using ((public.auth_user_tier() >= 2 and deleted_at is null) or public.auth_is_admin())
  with check (public.auth_user_tier() >= 2);
create policy jobs_del on public.jobs for delete to authenticated using (public.auth_is_admin());

-- ---- job worksheet cost tables (tier >= 2 only) --------------------
alter table public.job_quote_materials enable row level security;
create policy jqm_sel on public.job_quote_materials for select to authenticated using (public.auth_user_tier() >= 2);
create policy jqm_ins on public.job_quote_materials for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy jqm_upd on public.job_quote_materials for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy jqm_del on public.job_quote_materials for delete to authenticated using (public.auth_user_tier() >= 2);

alter table public.job_actual_materials enable row level security;
create policy jam_sel on public.job_actual_materials for select to authenticated using (public.auth_user_tier() >= 2);
create policy jam_ins on public.job_actual_materials for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy jam_upd on public.job_actual_materials for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy jam_del on public.job_actual_materials for delete to authenticated using (public.auth_user_tier() >= 2);

alter table public.job_quote_workforce enable row level security;
create policy jqw_sel on public.job_quote_workforce for select to authenticated using (public.auth_user_tier() >= 2);
create policy jqw_ins on public.job_quote_workforce for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy jqw_upd on public.job_quote_workforce for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy jqw_del on public.job_quote_workforce for delete to authenticated using (public.auth_user_tier() >= 2);

alter table public.job_actual_workforce enable row level security;
create policy jaw_sel on public.job_actual_workforce for select to authenticated using (public.auth_user_tier() >= 2);
create policy jaw_ins on public.job_actual_workforce for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy jaw_upd on public.job_actual_workforce for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy jaw_del on public.job_actual_workforce for delete to authenticated using (public.auth_user_tier() >= 2);

alter table public.job_quotation_summary enable row level security;
create policy jqs_sel on public.job_quotation_summary for select to authenticated using (public.auth_user_tier() >= 2);
create policy jqs_ins on public.job_quotation_summary for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy jqs_upd on public.job_quotation_summary for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy jqs_del on public.job_quotation_summary for delete to authenticated using (public.auth_user_tier() >= 2);

alter table public.job_actual_summary enable row level security;
create policy jas_sel on public.job_actual_summary for select to authenticated using (public.auth_user_tier() >= 2);
create policy jas_ins on public.job_actual_summary for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy jas_upd on public.job_actual_summary for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy jas_del on public.job_actual_summary for delete to authenticated using (public.auth_user_tier() >= 2);

-- ---- job_comments (Tier 1 may read AND add) ------------------------
alter table public.job_comments enable row level security;
create policy jc_sel on public.job_comments for select to authenticated using (public.auth_user_tier() >= 1);
create policy jc_ins on public.job_comments for insert to authenticated with check (public.auth_user_tier() >= 1 and user_id = (select auth.uid()));
create policy jc_upd on public.job_comments for update to authenticated using (user_id = (select auth.uid()) or public.auth_is_admin()) with check (user_id = (select auth.uid()) or public.auth_is_admin());
create policy jc_del on public.job_comments for delete to authenticated using (user_id = (select auth.uid()) or public.auth_is_admin());

-- ---- rough sheet / plates (no financial columns) -------------------
alter table public.rough_sheet_items enable row level security;
create policy rsi_sel on public.rough_sheet_items for select to authenticated using (public.auth_user_tier() >= 1);
create policy rsi_ins on public.rough_sheet_items for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy rsi_upd on public.rough_sheet_items for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy rsi_del on public.rough_sheet_items for delete to authenticated using (public.auth_user_tier() >= 2);

alter table public.cut_list_plates enable row level security;
create policy clp_sel on public.cut_list_plates for select to authenticated using (public.auth_user_tier() >= 1);
create policy clp_ins on public.cut_list_plates for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy clp_upd on public.cut_list_plates for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy clp_del on public.cut_list_plates for delete to authenticated using (public.auth_user_tier() >= 2);

-- ---- consumables (financial; soft delete admin-only via trigger) ---
alter table public.consumables enable row level security;
create policy cons_sel on public.consumables for select to authenticated using (public.auth_user_tier() >= 2 and deleted_at is null);
create policy cons_ins on public.consumables for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy cons_upd on public.consumables for update to authenticated
  using ((public.auth_user_tier() >= 2 and deleted_at is null) or public.auth_is_admin())
  with check (public.auth_user_tier() >= 2);
create policy cons_del on public.consumables for delete to authenticated using (public.auth_is_admin());

-- ---- job_materials / procurement (financial) -----------------------
alter table public.job_materials enable row level security;
create policy jm_sel on public.job_materials for select to authenticated using (public.auth_user_tier() >= 2 and deleted_at is null);
create policy jm_ins on public.job_materials for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy jm_upd on public.job_materials for update to authenticated
  using ((public.auth_user_tier() >= 2 and deleted_at is null) or public.auth_is_admin())
  with check (public.auth_user_tier() >= 2);
create policy jm_del on public.job_materials for delete to authenticated using (public.auth_is_admin());

-- ---- handover_items / drawings (non-financial) ---------------------
alter table public.handover_items enable row level security;
create policy ho_sel on public.handover_items for select to authenticated using (public.auth_user_tier() >= 1 and deleted_at is null);
create policy ho_ins on public.handover_items for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy ho_upd on public.handover_items for update to authenticated
  using ((public.auth_user_tier() >= 2 and deleted_at is null) or public.auth_is_admin())
  with check (public.auth_user_tier() >= 2);
create policy ho_del on public.handover_items for delete to authenticated using (public.auth_is_admin());

alter table public.drawings enable row level security;
create policy dr_sel on public.drawings for select to authenticated using (public.auth_user_tier() >= 1);
create policy dr_ins on public.drawings for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy dr_upd on public.drawings for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy dr_del on public.drawings for delete to authenticated using (public.auth_user_tier() >= 2);

-- ---- audit_log (admin read only; writes only via trigger) ----------
alter table public.audit_log enable row level security;
create policy audit_sel on public.audit_log for select to authenticated using (public.auth_is_admin());

-- ---- job_code_sequences (internal; no policies) --------------------
alter table public.job_code_sequences enable row level security;

-- =====================================================================
-- Grants: authenticated gets table DML (RLS gates it); anon gets nothing.
-- jobs base table is NOT directly selectable — reads go via jobs_view.
-- =====================================================================
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

revoke select on public.jobs from authenticated;
revoke all on public.job_code_sequences from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

grant select on public.jobs_view to authenticated;
grant select on public.rough_sheet_aggregated to authenticated;
grant select on public.cut_list_plates_aggregated to authenticated;
