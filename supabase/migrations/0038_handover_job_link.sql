-- =====================================================================
-- 0038: Handover items point at a real job.
--
-- Items described their job in free text, so the same job was typed one
-- way here and another on the Jobs tab. The link is nullable because a
-- forecasted item may not have a job raised for it yet.
-- =====================================================================

alter table public.handover_items
  add column job_id uuid references public.jobs(id) on delete set null;
create index handover_job_idx on public.handover_items(job_id);
