-- =====================================================================
-- 0013: worksheet-driven financials. quote_before_margin / final_quote /
-- margin / actual_cost / P&L are derived from the job's quote+actual sections
-- and the global section margins (app_config). Replaces the old
-- final_quote = qbm*(1+margin) trigger.
-- =====================================================================

-- default section margins (percent), admin-editable in Settings.
insert into public.app_config(key, value) values
  ('material_margin', '15'),
  ('workforce_margin', '15'),
  ('consumables_margin', '15')
on conflict (key) do nothing;

drop trigger if exists t20_compute_financials on public.jobs;

create or replace function public.recompute_job_financials(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mm numeric; wm numeric; cm numeric;
  m_sub numeric; w_sub numeric; c_sub numeric;
  am_sub numeric; aw_sub numeric; ac_sub numeric;
  v_qbm numeric; v_final numeric; v_actual numeric; v_has_actual boolean;
begin
  if public.auth_user_tier() < 2 then
    raise exception 'Not authorized';
  end if;

  select coalesce((select value::numeric from app_config where key='material_margin'),0)    into mm;
  select coalesce((select value::numeric from app_config where key='workforce_margin'),0)   into wm;
  select coalesce((select value::numeric from app_config where key='consumables_margin'),0) into cm;

  select coalesce(sum(total_cost),0) into m_sub from job_quote_materials   where job_id=p_job_id;
  select coalesce(sum(coalesce(total_hours,0)*coalesce(rate_aed_per_hr,0)),0) into w_sub
    from job_quote_workforce where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into c_sub from job_quote_consumables where job_id=p_job_id;

  select coalesce(sum(total_cost),0) into am_sub from job_actual_materials  where job_id=p_job_id;
  select coalesce(sum(coalesce(total_hours,0)*coalesce(rate_aed_per_hr,0)),0) into aw_sub
    from job_actual_workforce where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into ac_sub from job_actual_consumables where job_id=p_job_id;

  v_qbm   := m_sub + w_sub + c_sub;
  v_final := m_sub*(1+mm/100) + w_sub*(1+wm/100) + c_sub*(1+cm/100);
  v_actual := am_sub + aw_sub + ac_sub;
  v_has_actual := exists(select 1 from job_actual_materials   where job_id=p_job_id)
               or exists(select 1 from job_actual_workforce   where job_id=p_job_id)
               or exists(select 1 from job_actual_consumables where job_id=p_job_id);

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

-- Recompute every job (used after a margin change in Settings). Admin only.
create or replace function public.recompute_all_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if not public.auth_is_admin() then
    raise exception 'Not authorized';
  end if;
  for r in select id from jobs where deleted_at is null loop
    perform public.recompute_job_financials(r.id);
  end loop;
end;
$$;

revoke execute on function public.recompute_job_financials(uuid) from public, anon;
revoke execute on function public.recompute_all_jobs() from public, anon;
grant execute on function public.recompute_job_financials(uuid) to authenticated;
grant execute on function public.recompute_all_jobs() to authenticated;
