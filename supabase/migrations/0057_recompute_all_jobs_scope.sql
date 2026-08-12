-- =====================================================================
-- 0057: Narrow what a Settings margin change re-prices (Changes III item 7).
--
-- Saving the department margins called recompute_all_jobs(), which walked
-- every job that was not deleted. That re-priced finished work -- a job that
-- was completed, delivered or halted had its quote silently rewritten months
-- later -- and it also stamped over jobs whose margins had been set by hand
-- on the job itself (0051).
--
-- Two rules now, both enforced here rather than in the caller so a future
-- caller cannot forget them:
--
--   * only jobs with status = 'in_progress' are re-priced;
--   * a job carrying ANY per-job margin override is left alone entirely.
--
-- On the second rule: recompute_job_financials already coalesces override
-- over default, so a partially-overridden job would keep its override and
-- pick up the new default for its other sections. Skipping it outright is
-- the stricter reading of "do not change the jobs where the margins are
-- changed within the job tab", and a hand-tuned job staying exactly as the
-- estimator left it is the safer failure mode.
--
-- recompute_job_financials(uuid) is unchanged and still re-prices a single
-- job on demand regardless of status, which is what the worksheet needs when
-- its own lines or margins change.
-- =====================================================================

create or replace function public.recompute_all_jobs()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  if not public.auth_is_admin() then
    raise exception 'Not authorized';
  end if;

  for r in
    select id from jobs
     where deleted_at is null
       and status = 'in_progress'
       and margin_material_pct    is null
       and margin_workforce_pct   is null
       and margin_consumables_pct is null
       and margin_equipment_pct   is null
       and margin_services_pct    is null
  loop
    perform public.recompute_job_financials(r.id);
    n := n + 1;
  end loop;

  raise notice 'recompute_all_jobs: re-priced % in-progress job(s) without overrides', n;
end;
$$;
