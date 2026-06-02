-- =====================================================================
-- 0009_revoke_trigger_execute: remove trigger/internal SECURITY DEFINER
-- functions from the PostgREST RPC surface for anon AND authenticated.
-- (Supabase default privileges grant EXECUTE to these roles explicitly, so a
-- REVOKE FROM public alone is insufficient.) Triggers still fire normally;
-- set_job_code calls next_job_seq as its definer owner, so that still works.
-- =====================================================================
revoke execute on function public.audit_trigger() from anon, authenticated;
revoke execute on function public.emit_job_status_event() from anon, authenticated;
revoke execute on function public.set_job_code() from anon, authenticated;
revoke execute on function public.next_job_seq(text) from anon, authenticated;
revoke execute on function public.update_job_code_status() from anon, authenticated;
revoke execute on function public.guard_soft_delete() from anon, authenticated;
revoke execute on function public.guard_last_admin() from anon, authenticated;
revoke execute on function public.jobs_compute_financials() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
-- auth_user_tier / auth_is_admin remain executable by `authenticated` (used in
-- RLS policies); dashboard_financial_kpis and admin_create_user remain callable
-- by authenticated by design.
