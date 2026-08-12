-- =====================================================================
-- 0054: Close unauthenticated read access to the definer views.
--
-- SECURITY FIX. Found during the end-to-end audit, not reported by the
-- advisors (they flag the views as SECURITY DEFINER, which is intentional,
-- but not who may call them).
--
-- The masking views are deliberately `security_invoker = false` so they can
-- read the base tables as owner and null the money columns per tier. The
-- consequence is that **RLS on the underlying table does not apply to them**
-- -- the grant on the view is the entire access control.
--
-- Supabase's default `grant all on all tables in schema public to anon,
-- authenticated` therefore left three of these views readable by `anon`,
-- i.e. by anyone holding the publishable key, which ships in the browser
-- bundle and in .env.production. `jobs_view` had been revoked at some point;
-- the others were missed.
--
-- Verified before this migration, acting as the anon role:
--   anon -> projects_view       : 1 row readable (PRJ-2026-001)
--   anon -> jobs_view           : permission denied   (already correct)
--   anon -> jobs (base table)   : permission denied   (already correct)
--
-- Money was still masked (auth_user_tier() is 0 for anon, so
-- auth_can_see_money() is false), but project_code, name, status, site,
-- dates and notes were all exposed without signing in -- and the inventory
-- views would have exposed the stock register the same way once it holds
-- rows.
--
-- Nothing in the app reads these views unauthenticated, so revoking is
-- behaviour-neutral for the product.
-- =====================================================================

revoke all on public.projects_view       from anon;
revoke all on public.inventory_items_view from anon;
revoke all on public.inventory_low_stock  from anon;

-- The authenticated role keeps its access; tier filtering inside the views
-- and the base-table policies continue to do the real work.
grant select on public.projects_view        to authenticated;
grant select on public.inventory_items_view to authenticated;
grant select on public.inventory_low_stock  to authenticated;
