-- =====================================================================
-- 0032: Work out sheets required by nesting the pieces, not by area.
--
-- The old sum was  ceil(total_area / sheet_area * 1.15). A flat 15% waste
-- allowance is meaningless once a piece is large relative to the sheet:
-- one 6000 x 2000 piece on a 2x6 sheet is exactly one full sheet, but the
-- area sum returned ceil(12 / 12 * 1.15) = 2 and the shop was told to buy
-- twice the steel. That is the case sitting in the live cut list today.
--
-- Instead, work out how many pieces of a given size fit on a sheet, trying
-- both orientations, and let each piece consume 1/that of a sheet. The
-- floor() in the fit already discards the trim, so no extra waste factor is
-- applied - adding one would double-count it.
--
--   piece 6000x2000 on 2x6  -> fits 1 per sheet  -> 1 piece  = 1.00 sheet
--   piece   40x40   on 2x6  -> fits 7500 per sheet -> 2 pieces = 0.0003 sheet
--
-- Rows whose piece does not fit the sheet at all, or that are missing the
-- dimensions, fall back to the old area method so nothing silently drops
-- out of the order list.
-- =====================================================================

-- How many p_len x p_wid pieces fit on one sheet, best of both orientations.
-- NULL when the sheet size or the piece dimensions are unusable; 0 when the
-- piece is simply too big for the sheet.
create or replace function public.plate_pieces_per_sheet(
  p_size text, p_len_mm numeric, p_wid_mm numeric
) returns integer language sql immutable set search_path = public as $$
  with s as (
    select m[1]::numeric * 1000 as a_mm, m[2]::numeric * 1000 as b_mm
    from regexp_match(
           replace(lower(coalesce(p_size, '')), ',', '.'),
           '([0-9]+(?:\.[0-9]+)?)\s*[x*]\s*([0-9]+(?:\.[0-9]+)?)'
         ) as m
  )
  select greatest(
           floor(s.a_mm / p_wid_mm) * floor(s.b_mm / p_len_mm),
           floor(s.a_mm / p_len_mm) * floor(s.b_mm / p_wid_mm)
         )::int
  from s
  where p_len_mm > 0 and p_wid_mm > 0;
$$;

create or replace view public.cut_list_plates_aggregated with (security_invoker = true) as
select
  job_id,
  thickness_mm,
  plate_size,
  grade,
  sum(total_area_m2)                  as area_used,
  public.plate_sheet_area(plate_size) as sheet_area,
  -- Sheets a whole sheet can yield of the commonest piece on this line,
  -- shown so the engineer can sanity-check the nest.
  max(public.plate_pieces_per_sheet(plate_size, length_mm, width_mm)) as pieces_per_sheet,
  case
    when public.plate_sheet_area(plate_size) is null
     and count(*) filter (
           where public.plate_pieces_per_sheet(plate_size, length_mm, width_mm) > 0
         ) = 0
    then null
    else ceil(
      -- nested rows: each piece takes 1/(pieces per sheet) of a sheet
      coalesce(sum(
        case when public.plate_pieces_per_sheet(plate_size, length_mm, width_mm) > 0
             then qty::numeric
                  / public.plate_pieces_per_sheet(plate_size, length_mm, width_mm)
        end), 0)
      -- oversize or dimensionless rows: old area method, waste included
      + coalesce(sum(
        case when coalesce(public.plate_pieces_per_sheet(plate_size, length_mm, width_mm), 0) = 0
             then total_area_m2 * 1.15
                  / nullif(public.plate_sheet_area(plate_size), 0)
        end), 0)
    )::int
  end as sheets_required
from public.cut_list_plates
group by job_id, thickness_mm, plate_size, grade;

grant select on public.cut_list_plates_aggregated to authenticated;
revoke all   on public.cut_list_plates_aggregated from anon;
