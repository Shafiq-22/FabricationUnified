-- =====================================================================
-- 0014: historic procurement prices (drives the Tentative estimator and the
-- Procurement > Historic Prices sub-tab). security_invoker so job_materials
-- RLS (tier >= 2) applies.
-- =====================================================================
create or replace view public.historic_prices with (security_invoker = true) as
select
  lower(trim(item_name))                                                as item_key,
  max(item_name)                                                        as item_name,
  supplier,
  round(avg(unit_price), 2)                                            as avg_price,
  (array_agg(unit_price order by order_date desc nulls last))[1]        as last_price,
  max(order_date)                                                       as last_date,
  count(*)                                                              as order_count
from public.job_materials
where deleted_at is null and item_name is not null and unit_price is not null
group by lower(trim(item_name)), supplier;

grant select on public.historic_prices to authenticated;
revoke all on public.historic_prices from anon;
