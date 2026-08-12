-- =====================================================================
-- 0055: Remove the Clients model.
--
-- `clients` was a vestige of the original Client -> Project -> RFQ hierarchy.
-- What survived was half a feature: the Projects edit dialog had a Client
-- selector and the projects list and detail rendered a Client column, but
-- there was no reachable way to create a client (the manager component was
-- orphaned and its four CRUD actions were called from nowhere), so the
-- dropdown was permanently empty and every Client cell read "—".
--
-- Live state at removal: clients 0 rows, projects with client_id set 0,
-- rfqs 0 rows. Nothing is lost.
--
-- Removed here:
--   * clients table (and its four policies, dropped with it)
--   * projects.client_id and rfqs.client_id
--   * projects_view.client_name and the join behind it
--   * the "Client" branch of global_search, and client_name from the
--     subtitle of its Project branch
--
-- projects_view has to be DROPPED and recreated rather than replaced --
-- `create or replace view` can add columns but never remove one. A dropped
-- view also loses its grants, so they are restored explicitly below,
-- including the anon revoke established in 0054. Getting that wrong would
-- silently re-open the hole 0054 just closed.
--
-- `rfqs` itself is left in place: it is outside the Clients model, though it
-- is presently dead in the app (a type alias and nothing else) and is a
-- candidate for its own removal.
-- =====================================================================

-- The view depends on clients, so it goes first.
drop view if exists public.projects_view;

alter table public.projects drop column if exists client_id;
alter table public.rfqs     drop column if exists client_id;

drop table if exists public.clients cascade;

-- Rebuilt without the client join. Everything else is unchanged, including
-- security_invoker = false and the auth_can_see_money() masking.
create view public.projects_view with (security_invoker = false) as
select p.id, p.site_id,
       s.code as site_code, s.name as site_name,
       p.name, p.project_code, p.status,
       case when public.auth_can_see_money() then p.contract_value end as contract_value,
       p.start_date, p.target_completion, p.actual_completion, p.notes,
       p.created_by, p.created_at, p.updated_at,
       (select count(*) from public.jobs j
         where j.project_id = p.id and j.deleted_at is null) as job_count,
       case when public.auth_can_see_money() then
         (select coalesce(sum(j.final_quote), 0) from public.jobs j
           where j.project_id = p.id and j.deleted_at is null) end as quoted_value,
       case when public.auth_can_see_money() then
         (select coalesce(sum(j.actual_cost), 0) from public.jobs j
           where j.project_id = p.id and j.deleted_at is null) end as actual_value,
       (select count(*) from public.jobs j
         where j.project_id = p.id and j.deleted_at is null
           and j.status = any (array['completed','delivered'])) as completed_job_count
  from public.projects p
  left join public.sites s on s.id = p.site_id
 where p.deleted_at is null;

-- A recreated view starts with default grants; restore the intended set.
revoke all on public.projects_view from anon;
grant select on public.projects_view to authenticated;

-- global_search referenced both clients (its own result branch) and
-- projects_view.client_name (the Project subtitle), so it is rebuilt too.
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

union all
select 'Comment', jc.id, left(jc.body, 90), 'Job comment', to_char(jc.created_at, 'DD Mon YYYY'),
       '/jobs/' || jc.job_id || '/worksheet'
from public.job_comments jc, q
where to_tsvector('simple', coalesce(jc.body,'')) @@ q.tsq or jc.body ilike q.pat

limit greatest(1, least(p_limit, 200));
$function$;
