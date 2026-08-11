-- =====================================================================
-- 0043: Cutting allowances become settings, deleted codes free up, and a
-- finished job with no quote is priced from what it cost.
--
-- 1. The section order list multiplied by 2 -- "a factor of 2 for
--    symmetrical assemblies" -- on top of a 10% waste allowance, so 25 m
--    of cuts ordered 10 bars against a theoretical 4.17. The doubling is
--    gone and the bar length and waste allowances are now settings.
--    (0044 then replaces the section calculation with nesting.)
--
-- 2. A soft-deleted job keeps its row for the audit trail, but its code
--    should not hold a number hostage: deleting every job in a month now
--    starts that month again at 001. Uniqueness becomes partial so a
--    freed code can be reissued.
--
-- 3. Work that was never quoted still has to be charged. Once such a job
--    is completed or delivered, its quote is derived from the actual
--    cost, section by section so each keeps its own margin. Any quoted
--    line at all means the quote stands as entered.
-- =====================================================================

insert into public.app_config(key, value)
select * from (values
  ('bar_length_m', '6'),
  ('section_waste_pct', '10'),
  ('plate_waste_pct', '15')
) v(k, val)
where not exists (select 1 from public.app_config c where c.key = v.k);

create or replace function public.cfg_num(p_key text, p_default numeric)
returns numeric language sql stable set search_path = public as $$
  select coalesce((select nullif(value,'')::numeric from public.app_config where key = p_key), p_default);
$$;
revoke execute on function public.cfg_num(text, numeric) from public, anon;

create or replace view public.cut_list_plates_aggregated with (security_invoker = true) as
select
  job_id, thickness_mm, plate_size, grade,
  sum(total_area_m2)                  as area_used,
  public.plate_sheet_area(plate_size) as sheet_area,
  max(public.plate_pieces_per_sheet(plate_size, length_mm, width_mm)) as pieces_per_sheet,
  case
    when public.plate_sheet_area(plate_size) is null
     and count(*) filter (
           where public.plate_pieces_per_sheet(plate_size, length_mm, width_mm) > 0) = 0
    then null
    else ceil(
      coalesce(sum(
        case when public.plate_pieces_per_sheet(plate_size, length_mm, width_mm) > 0
             then qty::numeric / public.plate_pieces_per_sheet(plate_size, length_mm, width_mm)
        end), 0)
      + coalesce(sum(
        case when coalesce(public.plate_pieces_per_sheet(plate_size, length_mm, width_mm), 0) = 0
             then total_area_m2 * (1 + public.cfg_num('plate_waste_pct', 15) / 100)
                  / nullif(public.plate_sheet_area(plate_size), 0)
        end), 0)
    )::int
  end as sheets_required
from public.cut_list_plates
group by job_id, thickness_mm, plate_size, grade;

grant select on public.cut_list_plates_aggregated to authenticated;
revoke all   on public.cut_list_plates_aggregated from anon;

alter table public.jobs     drop constraint if exists jobs_job_code_key;
alter table public.projects drop constraint if exists projects_project_code_key;
create unique index jobs_job_code_live_idx on public.jobs(job_code)
  where deleted_at is null;
create unique index projects_project_code_live_idx on public.projects(project_code)
  where deleted_at is null;

create or replace function public.next_job_seq(p_year_month text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_seq int; v_max int;
begin
  -- Live jobs only: deleting them all starts the month again at 001.
  select coalesce(max((regexp_match(code_tail, '([0-9]+)$'))[1]::int), 0)
    into v_max
    from public.jobs
   where code_tail is not null
     and deleted_at is null
     and to_char(coalesce(start_date, created_at::date), 'YYYY-MM') = p_year_month;

  insert into public.job_code_sequences(year_month, last_seq)
  values (p_year_month, v_max + 1)
  on conflict (year_month) do update set last_seq = v_max + 1
  returning last_seq into v_seq;
  return v_seq;
end;
$$;

create or replace function public.next_project_seq(p_year text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_seq int; v_max int;
begin
  select coalesce(max((regexp_match(project_code, '([0-9]+)$'))[1]::int), 0)
    into v_max
    from public.projects
   where project_code like 'PRJ-' || p_year || '-%'
     and deleted_at is null;

  insert into public.project_code_sequences(year_key, last_seq)
  values (p_year, v_max + 1)
  on conflict (year_key) do update set last_seq = v_max + 1
  returning last_seq into v_seq;
  return v_seq;
end;
$$;

revoke execute on function public.next_job_seq(text)     from public, anon, authenticated;
revoke execute on function public.next_project_seq(text) from public, anon, authenticated;

create or replace function public.recompute_job_financials(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  mm numeric; wm numeric; cm numeric; em numeric; sm numeric;
  m_sub numeric; w_sub numeric; c_sub numeric; e_sub numeric; s_sub numeric;
  am_sub numeric; aw_sub numeric; ac_sub numeric; ae_sub numeric; as_sub numeric;
  v_qbm numeric; v_final numeric; v_actual numeric; v_has_actual boolean;
  v_status text;
begin
  if public.auth_user_tier() < 2 then
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
