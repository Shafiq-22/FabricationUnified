-- =====================================================================
-- 0036: Dimension and grade on procurement lines.
--
-- A procurement line describes a piece of steel, so it needs the same
-- shape the cut lists use. Without a dimension the drafted enquiry read
-- "SHS 100x100x5  11000  bars" with the size buried in a free-text name.
-- =====================================================================

alter table public.job_materials add column dimension text;
alter table public.job_materials add column grade text;
alter table public.consumables   add column dimension text;
