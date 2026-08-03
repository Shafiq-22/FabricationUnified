-- =====================================================================
-- 0025: expose jobs.project_id through jobs_view.
-- 0022 added the column to the base table but not to the masking view, so
-- the app (which may not read jobs directly) could not see a job's project.
-- project_id is appended at the end, which CREATE OR REPLACE VIEW permits and
-- which keeps every existing consumer working unchanged.
-- =====================================================================
create or replace view public.jobs_view with (security_invoker = false) as
select
  j.id, j.job_code, j.code_tail, j.company_job_code, j.quotation_ref, j.status,
  j.site_id, s.code as site_code, s.name as site_name,
  j.description, j.unit, j.qty, j.start_date, j.completion_date,
  case when public.auth_user_tier() >= 2 then j.charge_to_site      end as charge_to_site,
  case when public.auth_user_tier() >= 2 then j.quote_before_margin end as quote_before_margin,
  case when public.auth_user_tier() >= 2 then j.margin              end as margin,
  case when public.auth_user_tier() >= 2 then j.final_quote         end as final_quote,
  case when public.auth_user_tier() >= 2 then j.actual_cost         end as actual_cost,
  case when public.auth_user_tier() >= 2 then j.profit_loss         end as profit_loss,
  case when public.auth_user_tier() >= 2 then j.pl_percentage       end as pl_percentage,
  j.requisition_no, j.lpo_ref, j.inbound_outpass, j.exit_outpass, j.comments,
  j.created_by, u.full_name as created_by_name,
  j.created_at, j.updated_at,
  j.project_id
from public.jobs j
left join public.sites s on s.id = j.site_id
left join public.users u on u.id = j.created_by
where j.deleted_at is null;
