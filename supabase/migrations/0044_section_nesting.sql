-- =====================================================================
-- 0044: Sections nest like plates, in one dimension.
--
-- Dropping the x2 in 0043 left the waste-factor model, which rounds an
-- exact fit up: 6 m of cuts from a 6 m bar asked for 2 bars. Work out
-- instead how many pieces of a given length come off one bar and let each
-- piece consume 1/that of a bar. The floor() already discards the offcut,
-- so no waste factor is applied on top -- adding one would double-count.
--
--   one 6 m piece   from a 6 m bar -> 1 per bar -> 1 bar
--   four 3 m pieces from a 6 m bar -> 2 per bar -> 2 bars
--   ten 2.5 m       from a 6 m bar -> 2 per bar -> 5 bars
--   three 4 m       from a 6 m bar -> 1 per bar -> 3 bars
--
-- A piece longer than a bar, or with no length, falls back to
-- total/bar plus the waste allowance so nothing drops off the order list.
-- =====================================================================

drop view if exists public.rough_sheet_aggregated;
create view public.rough_sheet_aggregated with (security_invoker = true) as
select
  job_id,
  profile_type,
  dimension,
  grade,
  sum(total_length)                                              as total_length,
  round(sum(total_length) / public.cfg_num('bar_length_m', 6), 3) as theoretical_qty,
  max(floor(public.cfg_num('bar_length_m', 6) / nullif(length_m, 0))::int) as pieces_per_bar,
  ceil(
    coalesce(sum(
      case when length_m > 0 and length_m <= public.cfg_num('bar_length_m', 6)
           then qty::numeric / floor(public.cfg_num('bar_length_m', 6) / length_m)
      end), 0)
    + coalesce(sum(
      case when length_m is null or length_m <= 0
             or length_m > public.cfg_num('bar_length_m', 6)
           then total_length / public.cfg_num('bar_length_m', 6)
                * (1 + public.cfg_num('section_waste_pct', 10) / 100)
      end), 0)
  )::int                                                         as order_qty,
  count(*)                                                       as line_count
from public.rough_sheet_items
group by job_id, profile_type, dimension, grade;

grant select on public.rough_sheet_aggregated to authenticated;
revoke all   on public.rough_sheet_aggregated from anon;
