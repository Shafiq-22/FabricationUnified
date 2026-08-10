-- =====================================================================
-- 0037: Consumables can belong to a job.
--
-- Consumables were recorded per month only, so the tab could not be
-- grouped Project -> Job the way Job Material is. The link is nullable:
-- a drum of gas bought for the shop in general still belongs to nobody
-- in particular and stays under a general heading.
-- =====================================================================

alter table public.consumables
  add column job_id uuid references public.jobs(id) on delete set null;
create index consumables_job_idx on public.consumables(job_id);
