-- =====================================================================
-- 0021: Remove the inventory trigger/internal functions from the PostgREST
-- RPC surface. Triggers fire regardless of EXECUTE privilege, and
-- recompute_inventory_on_hand is only ever called from the trigger (which
-- runs as its definer owner), so nothing legitimate loses access.
-- Mirrors the hardening applied in 0009 for the job-code/audit functions.
-- =====================================================================
revoke execute on function public.recompute_inventory_on_hand(uuid) from public, anon, authenticated;
revoke execute on function public.tg_inventory_movement()          from public, anon, authenticated;
