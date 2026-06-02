-- =====================================================================
-- 0007_hardening: advisor fixes
--   * pin search_path on invoker trigger functions
--   * remove internal/trigger functions from the PostgREST RPC surface
--   * covering indexes for foreign keys
-- NOTE: public.jobs_view is intentionally SECURITY DEFINER — it is the
-- column-masking read path for jobs (Tier 1 sees NULL financials). The
-- "security_definer_view" advisor on it is reviewed and expected.
-- =====================================================================

-- Pin search_path (clears function_search_path_mutable warnings).
alter function public.set_updated_at() set search_path = public;
alter function public.jobs_compute_financials() set search_path = public;
alter function public.update_job_code_status() set search_path = public;
alter function public.guard_soft_delete() set search_path = public;
alter function public.guard_last_admin() set search_path = public;
alter function public.status_to_prefix(text) set search_path = public;

-- Internal/trigger functions: not meant to be called as RPC. Triggers still
-- fire regardless of EXECUTE grants.
revoke execute on function public.audit_trigger() from public;
revoke execute on function public.emit_job_status_event() from public;
revoke execute on function public.next_job_seq(text) from public;
revoke execute on function public.set_job_code() from public;
revoke execute on function public.update_job_code_status() from public;
revoke execute on function public.guard_soft_delete() from public;
revoke execute on function public.guard_last_admin() from public;
revoke execute on function public.jobs_compute_financials() from public;
revoke execute on function public.set_updated_at() from public;

-- Helpers used inside RLS / triggers: only authenticated needs them.
revoke execute on function public.auth_user_tier() from public, anon;
revoke execute on function public.auth_is_admin() from public, anon;
revoke execute on function public.status_to_prefix(text) from public, anon;
grant execute on function public.auth_user_tier() to authenticated;
grant execute on function public.auth_is_admin() to authenticated;
grant execute on function public.status_to_prefix(text) to authenticated;

-- Covering indexes for foreign keys.
create index if not exists jobs_created_by_idx on public.jobs(created_by);
create index if not exists consumables_created_by_idx on public.consumables(created_by);
create index if not exists job_materials_created_by_idx on public.job_materials(created_by);
create index if not exists handover_created_by_idx on public.handover_items(created_by);
create index if not exists handover_site_idx on public.handover_items(site_id);
create index if not exists job_comments_user_idx on public.job_comments(user_id);
create index if not exists users_role_tier_idx on public.users(role_tier);
