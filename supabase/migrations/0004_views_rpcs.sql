-- =====================================================================
-- 0004_views_rpcs: masking view, aggregation views, dashboard RPCs
-- =====================================================================

-- Masking view: SECURITY DEFINER (security_invoker=false) so it can read the
-- base table after we revoke direct SELECT from `authenticated`. It re-applies
-- the soft-delete filter (definer bypasses RLS) and nulls all monetary columns
-- for Tier 1 (< 2). This is the ONLY read path for jobs.
create or replace view public.jobs_view with (security_invoker = false) as
select
  j.id, j.job_code, j.code_tail, j.company_job_code, j.quotation_ref, j.status,
  j.site_id, s.code as site_code, s.name as site_name,
  j.description, j.unit, j.qty, j.start_date, j.completion_date,
  case when public.auth_user_tier() >= 2 then j.charge_to_site      end as charge_to_site,
  case when public.auth_user_tier() >= 2 then j.quote_before_margin end as quote_before_margin,
  case when public.auth_user_tier() >= 2 then j.margin              end as margin,
  case when public.auth_user_tier() >= 2 then j.final_quote         end as final_quote,
  case when public.auth_user_tier() >= 2 then j.actual_cost         end as actual_cost,
  case when public.auth_user_tier() >= 2 then j.profit_loss         end as profit_loss,
  case when public.auth_user_tier() >= 2 then j.pl_percentage       end as pl_percentage,
  j.requisition_no, j.lpo_ref, j.inbound_outpass, j.exit_outpass, j.comments,
  j.created_by, u.full_name as created_by_name,
  j.created_at, j.updated_at
from public.jobs j
left join public.sites s on s.id = j.site_id
left join public.users u on u.id = j.created_by
where j.deleted_at is null;

-- Rough-sheet order list: grouped by profile + dimension. Section bars are 6 m;
-- factor of 2 for symmetrical assemblies, 10% waste.
create or replace view public.rough_sheet_aggregated with (security_invoker = true) as
select
  job_id,
  profile_type,
  dimension,
  sum(total_length)                              as total_length,
  round(sum(total_length) / 6.0, 3)              as theoretical_qty,
  ceil(sum(total_length) / 6.0 * 2 * 1.1)::int   as order_qty,
  count(*)                                       as line_count
from public.rough_sheet_items
group by job_id, profile_type, dimension;

-- Plate order list: grouped by thickness + sheet size, 15% nesting waste.
create or replace view public.cut_list_plates_aggregated with (security_invoker = true) as
select
  job_id,
  thickness_mm,
  plate_size,
  sum(total_area_m2) as area_used,
  ceil(
    sum(total_area_m2)
    / nullif(case plate_size when '2x6' then 12.0 when '1.5x6' then 9.0 else null end, 0)
    * 1.15
  )::int as sheets_required
from public.cut_list_plates
group by job_id, thickness_mm, plate_size;

-- Financial dashboard KPIs (Tier 2+ only). Tier 1 receives {authorized:false}.
create or replace function public.dashboard_financial_kpis(p_month text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_cons numeric;
begin
  if public.auth_user_tier() < 2 then
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

revoke all on function public.dashboard_financial_kpis(text) from public, anon;
grant execute on function public.dashboard_financial_kpis(text) to authenticated;
