-- =====================================================================
-- 0026: pin search_path on global_search (advisor: function_search_path_mutable).
-- It is SECURITY INVOKER so RLS still applies to the caller; pinning simply
-- removes the chance of resolution against an attacker-controlled schema.
-- =====================================================================
alter function public.global_search(text, int) set search_path = public;
