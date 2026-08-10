-- =====================================================================
-- 0035: Inflation on historic prices, and OT rates per role.
--
-- Tentative quoting priced items straight off past purchase orders, so a
-- price from last year was quoted as if it were today's. The yearly rate
-- lives in Settings and is applied pro-rata to the age of the price.
--
-- Timesheet rates were one normal rate and one OT rate for the whole shop.
-- labour_rates already carried a normal rate per designation; it now
-- carries the OT rate too, seeded from the existing generic ratio so no
-- figure changes value on the day this lands.
-- =====================================================================

insert into public.app_config(key, value)
select 'inflation_rate_pct', '10'
where not exists (select 1 from public.app_config where key = 'inflation_rate_pct');

alter table public.labour_rates add column ot_rate_aed_per_hr numeric(12,2);

update public.labour_rates
   set ot_rate_aed_per_hr = round(
     rate_aed_per_hr *
     coalesce(
       (select nullif(value::numeric,0) from public.app_config where key='timesheet_ot_rate')
       / nullif((select nullif(value::numeric,0) from public.app_config where key='timesheet_normal_rate'), 0),
       1.5),
     2)
 where ot_rate_aed_per_hr is null;
