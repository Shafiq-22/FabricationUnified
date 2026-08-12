-- =====================================================================
-- 0056: Make the universal search actually universal (Changes III item 8).
--
-- The report was "searching brings up No matches". The search was not broken
-- -- it simply did not index the things people search for. Measured against
-- the live data before this change:
--
--   Pipe 3, BAF 1, PRJ 1, Ajman 1, Requisition 1     (jobs/projects/documents)
--   Gullu 0, Surendra 0, Mani 0, Shafiq 0, Welder 0  (19 personnel, 1 contact)
--   Gantry 0, Crane 0                                (2 machines)
--
-- Every person and every machine on the system was invisible to it, which is
-- exactly what someone would type first.
--
-- Adds five branches: Contact, Personnel, Equipment, Certificate and Note.
-- The function stays SECURITY INVOKER, so RLS still decides what each tier is
-- allowed to see -- notably a tier-2 user gets no rows from tables it cannot
-- read, without this function needing to know anything about tiers.
--
-- Notes link to the job that owns them; the rest link to the tab that lists
-- them (values taken from each page's own Tab union, not guessed).
-- =====================================================================

create or replace function public.global_search(p_q text, p_limit integer default 60)
returns table(kind text, id uuid, title text, subtitle text, meta text, href text)
language sql stable set search_path to 'public' as $function$
with q as (
  select websearch_to_tsquery('simple', p_q) as tsq,
         '%' || trim(p_q) || '%' as pat
)
select 'Job', j.id, j.job_code,
       coalesce(j.description, ''),
       coalesce(j.site_code,'') || ' · ' || coalesce(j.status,''),
       '/jobs/' || j.id || '/worksheet'
from public.jobs_view j, q
where to_tsvector('simple', coalesce(j.job_code,'') || ' ' || coalesce(j.description,'') || ' ' ||
      coalesce(j.company_job_code,'') || ' ' || coalesce(j.quotation_ref,'')) @@ q.tsq
   or j.job_code ilike q.pat or j.description ilike q.pat

union all
select 'Project', p.id, p.project_code, coalesce(p.name,''),
       coalesce(p.site_code,'') || ' · ' || coalesce(p.status,''), '/projects'
from public.projects_view p, q
where to_tsvector('simple', coalesce(p.project_code,'') || ' ' || coalesce(p.name,'')) @@ q.tsq
   or p.project_code ilike q.pat or p.name ilike q.pat

union all
select 'Document', d.id, coalesce(d.title, d.original_filename, 'Document'),
       coalesce(d.doc_type,''), coalesce(d.revision,''), '/documents'
from public.documents d, q
where d.deleted_at is null
  and (to_tsvector('simple', coalesce(d.title,'') || ' ' || coalesce(d.original_filename,'') || ' ' ||
       coalesce(d.notes,'') || ' ' || coalesce(d.revision,'')) @@ q.tsq
   or d.title ilike q.pat or d.original_filename ilike q.pat)

union all
select 'Stock', i.id, coalesce(i.description,''),
       coalesce(i.item_code,'') || ' · ' || coalesce(i.item_type,''),
       coalesce(i.dimensions,'') || ' ' || coalesce(i.material_grade,''), '/inventory'
from public.inventory_items_view i, q
where to_tsvector('simple', coalesce(i.item_code,'') || ' ' || coalesce(i.description,'') || ' ' ||
      coalesce(i.material_grade,'') || ' ' || coalesce(i.dimensions,'')) @@ q.tsq
   or i.description ilike q.pat or i.item_code ilike q.pat

union all
select 'Supplier', s.id, s.name, coalesce(s.category,''), coalesce(s.contact_name,''), '/procurement?tab=suppliers'
from public.suppliers s, q
where to_tsvector('simple', coalesce(s.name,'') || ' ' || coalesce(s.category,'')) @@ q.tsq
   or s.name ilike q.pat

union all
select 'NCR', n.id, n.title, coalesce(n.status,''), coalesce(n.item_ref,''), '/qa?tab=ncrs'
from public.ncrs n, q
where n.deleted_at is null
  and (to_tsvector('simple', coalesce(n.title,'') || ' ' || coalesce(n.description,'') || ' ' ||
       coalesce(n.item_ref,'')) @@ q.tsq
   or n.title ilike q.pat)

-- ---- new in 0056 ----------------------------------------------------
union all
select 'Contact', c.id, c.name,
       coalesce(c.organisation,''),
       coalesce(c.email, c.phone, ''), '/contacts'
from public.contacts c, q
where to_tsvector('simple', coalesce(c.name,'') || ' ' || coalesce(c.organisation,'') || ' ' ||
      coalesce(c.email,'')) @@ q.tsq
   or c.name ilike q.pat or c.organisation ilike q.pat

union all
select 'Personnel', pe.id, pe.name,
       coalesce(pe.trade,''),
       coalesce(pe.ho_no,''), '/records?tab=manage'
from public.personnel pe, q
where to_tsvector('simple', coalesce(pe.name,'') || ' ' || coalesce(pe.trade,'') || ' ' ||
      coalesce(pe.ho_no,'')) @@ q.tsq
   or pe.name ilike q.pat or pe.trade ilike q.pat

union all
select 'Equipment', e.id, coalesce(e.machine,''),
       coalesce(e.sixco_no,''),
       coalesce(e.status,''), '/records?tab=equipment'
from public.equipment e, q
where to_tsvector('simple', coalesce(e.machine,'') || ' ' || coalesce(e.sixco_no,'')) @@ q.tsq
   or e.machine ilike q.pat or e.sixco_no ilike q.pat

union all
select 'Certificate', w.id, w.name,
       coalesce(w.certificate_no,''),
       coalesce(w.position,''), '/qa?tab=certificates'
from public.welder_certificates w, q
where w.deleted_at is null
  and (to_tsvector('simple', coalesce(w.name,'') || ' ' || coalesce(w.certificate_no,'') || ' ' ||
       coalesce(w.position,'')) @@ q.tsq
   or w.name ilike q.pat or w.certificate_no ilike q.pat)

union all
select 'Note', jn.id, left(jn.body, 90),
       'Job note #' || jn.seq_no,
       to_char(jn.created_at, 'DD Mon YYYY'),
       '/jobs/' || jn.job_id || '/worksheet'
from public.job_notes jn, q
where jn.deleted_at is null
  and (to_tsvector('simple', coalesce(jn.body,'')) @@ q.tsq or jn.body ilike q.pat)

union all
select 'Comment', jc.id, left(jc.body, 90), 'Job comment', to_char(jc.created_at, 'DD Mon YYYY'),
       '/jobs/' || jc.job_id || '/worksheet'
from public.job_comments jc, q
where to_tsvector('simple', coalesce(jc.body,'')) @@ q.tsq or jc.body ilike q.pat

limit greatest(1, least(p_limit, 200));
$function$;
