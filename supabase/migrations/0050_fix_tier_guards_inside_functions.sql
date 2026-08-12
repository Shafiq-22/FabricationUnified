-- =====================================================================
-- 0050: Fix the tier guards left behind inside function bodies by 0049.
--
-- 0049 re-cut the tiers so that money belongs to tiers 1 and 3 and tier 2
-- is the restricted one. That sweep rewrote the RLS policies and the three
-- masking views, but it did not touch the guards *hardcoded inside
-- function bodies*, which still read `auth_user_tier() < 2` -- a test that
-- meant "is the read-only tier" under the old numbering and means nothing
-- coherent under the new one.
--
-- Verified live before this migration, per tier:
--
--   dashboard_financial_kpis   tier 1 -> {authorized:false}  (wrongly denied)
--                              tier 2 -> real P&L returned   (MONEY LEAK)
--   recompute_job_financials   tier 1 -> 'Not authorized'    (cannot save)
--                              tier 2 -> allowed             (wrong way round)
--
-- The dashboard case is the serious one: it handed profit/loss, charges and
-- quoted totals to the one tier that must never see money, straight past the
-- masking views. Not reachable in practice yet only because no tier-1 or
-- tier-2 account exists.
--
-- Both now defer to auth_can_see_money(), the single predicate, so there is
-- no second copy of the rule to drift again.
--
-- LESSON for future tier changes: grep function BODIES, not just policies --
--   select proname from pg_proc where pg_get_functiondef(oid) ~ 'auth_user_tier\(\)\s*[<>=!]+\s*\d';
-- should return nothing but auth_can_act_on_job and guard_soft_delete, which
-- legitimately test `= 2` to mean "the restricted tier".
-- =====================================================================

create or replace function public.dashboard_financial_kpis(p_month text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  v_cons numeric;
begin
  if not public.auth_can_see_money() then
    return jsonb_build_object('authorized', false);
  end if;

  select coalesce(sum(total_price), 0) into v_cons
  from public.consumables
  where deleted_at is null and month_year = p_month;

  with month_jobs as (
    select * from public.jobs
    where deleted_at is null
      and to_char(coalesce(start_date, created_at::date), 'YYYY-MM') = p_month
  )
  select jsonb_build_object(
    'authorized', true,
    'total_pl',            coalesce((select sum(profit_loss) from month_jobs), 0),
    'gross_pl',            coalesce((select sum(profit_loss) from month_jobs), 0)
                             - v_cons
                             - coalesce((select sum(charge_to_site) from month_jobs), 0),
    'total_daywork',       coalesce((select sum(final_quote) from month_jobs where status = 'delivered'), 0),
    'charges_to_baf',      coalesce((select sum(charge_to_site) from month_jobs), 0),
    'consumables_total',   v_cons,
    'avg_supplier_lead_time', (
      select round(avg(time_to_deliver_days)::numeric, 1)
      from public.job_materials
      where deleted_at is null and delivery_date is not null
        and to_char(order_date, 'YYYY-MM') = p_month)
  ) into result;

  return result;
end;
$$;

-- Only the guard changes here; the arithmetic is untouched, so existing job
-- quotes must come out byte-identical. Asserted live either side of this.
create or replace function public.recompute_job_financials(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  mm numeric; wm numeric; cm numeric; em numeric; sm numeric;
  m_sub numeric; w_sub numeric; c_sub numeric; e_sub numeric; s_sub numeric;
  am_sub numeric; aw_sub numeric; ac_sub numeric; ae_sub numeric; as_sub numeric;
  v_qbm numeric; v_final numeric; v_actual numeric; v_has_actual boolean;
  v_status text; v_from_actual boolean := false;
begin
  if not public.auth_can_see_money() then
    raise exception 'Not authorized';
  end if;

  select coalesce((select value::numeric from app_config where key='material_margin'),0)    into mm;
  select coalesce((select value::numeric from app_config where key='workforce_margin'),0)   into wm;
  select coalesce((select value::numeric from app_config where key='consumables_margin'),0) into cm;
  select coalesce((select value::numeric from app_config where key='equipment_margin'),0)   into em;
  select coalesce((select value::numeric from app_config where key='services_margin'),0)    into sm;
  select status into v_status from jobs where id = p_job_id;

  select coalesce(sum(total_cost),0) into m_sub from job_quote_materials   where job_id=p_job_id;
  select coalesce(sum(coalesce(total_hours,0)*coalesce(rate_aed_per_hr,0)),0) into w_sub
    from job_quote_workforce where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into c_sub from job_quote_consumables where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into e_sub from job_quote_equipment   where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into s_sub from job_quote_services    where job_id=p_job_id;

  select coalesce(sum(total_cost),0) into am_sub from job_actual_materials  where job_id=p_job_id;
  select coalesce(sum(coalesce(total_hours,0)*coalesce(rate_aed_per_hr,0)),0) into aw_sub
    from job_actual_workforce where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into ac_sub from job_actual_consumables where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into ae_sub from job_actual_equipment   where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into as_sub from job_actual_services    where job_id=p_job_id;

  v_actual := am_sub + aw_sub + ac_sub + ae_sub + as_sub;
  v_has_actual := exists(select 1 from job_actual_materials   where job_id=p_job_id)
               or exists(select 1 from job_actual_workforce   where job_id=p_job_id)
               or exists(select 1 from job_actual_consumables where job_id=p_job_id)
               or exists(select 1 from job_actual_equipment   where job_id=p_job_id)
               or exists(select 1 from job_actual_services    where job_id=p_job_id);

  -- Work that was never quoted still has to be charged. Once it is finished,
  -- price it from what it actually cost, section by section so each keeps its
  -- own margin. Any quoted line at all means the quote stands as entered.
  if (m_sub + w_sub + c_sub + e_sub + s_sub) = 0
     and v_has_actual
     and v_status in ('completed','delivered') then
    m_sub := am_sub; w_sub := aw_sub; c_sub := ac_sub; e_sub := ae_sub; s_sub := as_sub;
    v_from_actual := true;
  end if;

  v_qbm   := m_sub + w_sub + c_sub + e_sub + s_sub;
  v_final := m_sub*(1+mm/100) + w_sub*(1+wm/100) + c_sub*(1+cm/100)
           + e_sub*(1+em/100) + s_sub*(1+sm/100);

  update jobs set
    quote_before_margin = round(v_qbm, 2),
    final_quote         = round(v_final, 2),
    margin              = case when v_qbm = 0 then 0 else round(v_final / v_qbm - 1, 4) end,
    actual_cost         = case when v_has_actual then round(v_actual, 2) else null end,
    profit_loss         = case when v_has_actual then round(v_final - v_actual, 2) else null end,
    pl_percentage       = case when v_has_actual and v_final <> 0
                               then round((v_final - v_actual) / v_final, 4) else null end
  where id = p_job_id;
end;
$$;
