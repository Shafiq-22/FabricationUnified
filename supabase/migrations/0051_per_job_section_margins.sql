-- =====================================================================
-- 0051: Per-job, per-section margin overrides (Changes II, item 4).
--
-- Margins lived only in app_config, one figure per section for the whole
-- department. A job that needs a different mark-up on, say, services had no
-- way to say so. Each job may now carry its own percentage per section;
-- null means "use the Settings default", so nothing changes for the jobs
-- already on the books.
--
-- These are financial columns and are treated exactly like the existing
-- money columns: SELECT is NOT granted to `authenticated` on the base table
-- (so tier 2 cannot read them even directly through PostgREST), and they are
-- exposed through jobs_view behind auth_can_see_money(). UPDATE is granted,
-- because setting an override is an ordinary edit for a money-tier user --
-- new columns do not inherit the table's existing column grants.
--
-- REGRESSION-CRITICAL: recompute_job_financials changes here. The only
-- difference is coalesce(job override, app_config default) in place of the
-- bare app_config lookup, so with no overrides set every stored figure must
-- come out identical. Asserted live either side of this migration.
-- =====================================================================

alter table public.jobs
  add column if not exists margin_material_pct    numeric,
  add column if not exists margin_workforce_pct   numeric,
  add column if not exists margin_consumables_pct numeric,
  add column if not exists margin_equipment_pct   numeric,
  add column if not exists margin_services_pct    numeric;

comment on column public.jobs.margin_material_pct is
  'Per-job material margin %. Null = use app_config.material_margin.';

-- Money columns: writable by a money tier, never directly readable.
grant update (
  margin_material_pct, margin_workforce_pct, margin_consumables_pct,
  margin_equipment_pct, margin_services_pct
) on public.jobs to authenticated;

-- ---------------------------------------------------------------------
-- Surface the overrides through the masking view, on the same predicate as
-- every other money column.
-- ---------------------------------------------------------------------
create or replace view public.jobs_view with (security_invoker = false) as
select j.id, j.job_code, j.code_tail, j.company_job_code, j.quotation_ref,
       j.status, j.site_id, s.code as site_code, s.name as site_name,
       j.description, j.unit, j.qty, j.start_date, j.completion_date,
       case when public.auth_can_see_money() then j.charge_to_site end      as charge_to_site,
       case when public.auth_can_see_money() then j.quote_before_margin end as quote_before_margin,
       case when public.auth_can_see_money() then j.margin end              as margin,
       case when public.auth_can_see_money() then j.final_quote end         as final_quote,
       case when public.auth_can_see_money() then j.actual_cost end         as actual_cost,
       case when public.auth_can_see_money() then j.profit_loss end         as profit_loss,
       case when public.auth_can_see_money() then j.pl_percentage end       as pl_percentage,
       j.requisition_no, j.lpo_ref, j.inbound_outpass, j.exit_outpass,
       j.comments, j.created_by, u.full_name as created_by_name,
       j.created_at, j.updated_at, j.project_id,
       -- Appended at the end deliberately: `create or replace view` may only
       -- add columns after the existing ones, never insert among them.
       case when public.auth_can_see_money() then j.margin_material_pct end    as margin_material_pct,
       case when public.auth_can_see_money() then j.margin_workforce_pct end   as margin_workforce_pct,
       case when public.auth_can_see_money() then j.margin_consumables_pct end as margin_consumables_pct,
       case when public.auth_can_see_money() then j.margin_equipment_pct end   as margin_equipment_pct,
       case when public.auth_can_see_money() then j.margin_services_pct end    as margin_services_pct
  from public.jobs j
  left join public.sites s on s.id = j.site_id
  left join public.users u on u.id = j.created_by
 where j.deleted_at is null;

-- ---------------------------------------------------------------------
-- Recompute: per-job override first, Settings default second.
-- ---------------------------------------------------------------------
create or replace function public.recompute_job_financials(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  mm numeric; wm numeric; cm numeric; em numeric; sm numeric;
  m_sub numeric; w_sub numeric; c_sub numeric; e_sub numeric; s_sub numeric;
  am_sub numeric; aw_sub numeric; ac_sub numeric; ae_sub numeric; as_sub numeric;
  v_qbm numeric; v_final numeric; v_actual numeric; v_has_actual boolean;
  v_status text; v_from_actual boolean := false;
  o_m numeric; o_w numeric; o_c numeric; o_e numeric; o_s numeric;
begin
  if not public.auth_can_see_money() then
    raise exception 'Not authorized';
  end if;

  select status,
         margin_material_pct, margin_workforce_pct, margin_consumables_pct,
         margin_equipment_pct, margin_services_pct
    into v_status, o_m, o_w, o_c, o_e, o_s
    from jobs where id = p_job_id;

  -- The job's own margin wins; otherwise the department default.
  select coalesce(o_m, (select value::numeric from app_config where key='material_margin'),    0) into mm;
  select coalesce(o_w, (select value::numeric from app_config where key='workforce_margin'),   0) into wm;
  select coalesce(o_c, (select value::numeric from app_config where key='consumables_margin'), 0) into cm;
  select coalesce(o_e, (select value::numeric from app_config where key='equipment_margin'),   0) into em;
  select coalesce(o_s, (select value::numeric from app_config where key='services_margin'),    0) into sm;

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
