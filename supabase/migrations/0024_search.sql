-- =====================================================================
-- 0024: Global full-text search.
-- global_search is SECURITY INVOKER (the default) so RLS and the masking
-- views apply per caller: it reads jobs_view / projects_view / inventory_items_view,
-- never the base tables. Tier 1 therefore gets results without financials.
-- =====================================================================

-- GIN indexes on the text actually searched.
create index if not exists jobs_fts_idx on public.jobs
  using gin (to_tsvector('simple',
    coalesce(job_code,'') || ' ' || coalesce(description,'') || ' ' ||
    coalesce(company_job_code,'') || ' ' || coalesce(quotation_ref,'')));

create index if not exists documents_fts_idx on public.documents
  using gin (to_tsvector('simple',
    coalesce(title,'') || ' ' || coalesce(original_filename,'') || ' ' ||
    coalesce(notes,'') || ' ' || coalesce(revision,'')));

create index if not exists inventory_fts_idx on public.inventory_items
  using gin (to_tsvector('simple',
    coalesce(item_code,'') || ' ' || coalesce(description,'') || ' ' ||
    coalesce(material_grade,'') || ' ' || coalesce(dimensions,'')));

create index if not exists suppliers_fts_idx on public.suppliers
  using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(category,'')));

create index if not exists projects_fts_idx on public.projects
  using gin (to_tsvector('simple', coalesce(project_code,'') || ' ' || coalesce(name,'')));

create index if not exists ncrs_fts_idx on public.ncrs
  using gin (to_tsvector('simple',
    coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(item_ref,'')));

create index if not exists comments_fts_idx on public.job_comments
  using gin (to_tsvector('simple', coalesce(body,'')));

create index if not exists clients_fts_idx on public.clients
  using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(contact_name,'')));

-- ---------------------------------------------------------------------
-- One RPC returning a uniform result shape the UI can group by `kind`.
-- Uses websearch_to_tsquery so users can type quoted phrases and -negation.
-- ---------------------------------------------------------------------
create or replace function public.global_search(p_q text, p_limit int default 60)
returns table (kind text, id uuid, title text, subtitle text, meta text, href text)
language sql
stable
as $$
with q as (
  select websearch_to_tsquery('simple', p_q) as tsq,
         '%' || trim(p_q) || '%' as pat
)
-- Jobs (via the masking view: no financials leak to Tier 1)
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
       coalesce(p.client_name,'') || ' · ' || coalesce(p.status,''), '/projects'
from public.projects_view p, q
where to_tsvector('simple', coalesce(p.project_code,'') || ' ' || coalesce(p.name,'')) @@ q.tsq
   or p.project_code ilike q.pat or p.name ilike q.pat

union all
select 'Client', c.id, c.name, coalesce(c.contact_name,''), coalesce(c.contact_email,''), '/clients'
from public.clients c, q
where to_tsvector('simple', coalesce(c.name,'') || ' ' || coalesce(c.contact_name,'')) @@ q.tsq
   or c.name ilike q.pat

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

union all
select 'Comment', jc.id, left(jc.body, 90), 'Job comment', to_char(jc.created_at, 'DD Mon YYYY'),
       '/jobs/' || jc.job_id || '/worksheet'
from public.job_comments jc, q
where to_tsvector('simple', coalesce(jc.body,'')) @@ q.tsq or jc.body ilike q.pat

limit greatest(1, least(p_limit, 200));
$$;

revoke execute on function public.global_search(text, int) from public, anon;
grant execute on function public.global_search(text, int) to authenticated;
