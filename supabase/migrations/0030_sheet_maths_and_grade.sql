-- =====================================================================
-- 0030: Steel grade on the order lists, and a sheet-area calculation that
-- copes with the sizes the field actually accepts.
--
-- cut_list_plates_aggregated mapped the sheet size with
--   case plate_size when '2x6' then 12.0 when '1.5x6' then 9.0 else null end
-- so ONLY those two exact strings produced a sheet count. The input's own
-- placeholder is "2x6 / 1.5x6 / custom", and '2 x 6', '2X6', '1.25x2.5' and
-- every other custom size silently returned NULL sheets required — the row
-- showed a dash and the plate was simply never ordered.
--
-- plate_sheet_area parses the size instead, so any "A x B" in metres works.
-- It reproduces the old map exactly for '2x6' (12) and '1.5x6' (9), so
-- existing rows are unaffected.
--
-- Grade joins both groupings: S275 and S355 of the same section are different
-- purchases and must not be merged into one order line.
-- =====================================================================

create or replace function public.plate_sheet_area(p_size text)
returns numeric language sql immutable set search_path = public as $$
  select m[1]::numeric * m[2]::numeric
  from regexp_match(
         replace(lower(coalesce(p_size, '')), ',', '.'),
         '([0-9]+(?:\.[0-9]+)?)\s*[x*]\s*([0-9]+(?:\.[0-9]+)?)'
       ) as m
  where m[1] is not null and m[2] is not null;
$$;

create or replace view public.rough_sheet_aggregated with (security_invoker = true) as
select
  job_id,
  profile_type,
  dimension,
  grade,
  sum(total_length)                              as total_length,
  round(sum(total_length) / 6.0, 3)              as theoretical_qty,
  ceil(sum(total_length) / 6.0 * 2 * 1.1)::int   as order_qty,
  count(*)                                       as line_count
from public.rough_sheet_items
group by job_id, profile_type, dimension, grade;

create or replace view public.cut_list_plates_aggregated with (security_invoker = true) as
select
  job_id,
  thickness_mm,
  plate_size,
  grade,
  sum(total_area_m2)                                  as area_used,
  public.plate_sheet_area(plate_size)                 as sheet_area,
  ceil(sum(total_area_m2)
       / nullif(public.plate_sheet_area(plate_size), 0)
       * 1.15)::int                                   as sheets_required
from public.cut_list_plates
group by job_id, thickness_mm, plate_size, grade;

grant select on public.rough_sheet_aggregated      to authenticated;
grant select on public.cut_list_plates_aggregated  to authenticated;
revoke all on public.rough_sheet_aggregated      from anon;
revoke all on public.cut_list_plates_aggregated  from anon;
