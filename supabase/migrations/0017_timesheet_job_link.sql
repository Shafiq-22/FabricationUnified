-- =====================================================================
-- 0017: link timesheet entries to a job (Job Name column + autofill of
-- site / job ref). Nullable so free-form entries are still allowed.
-- =====================================================================
alter table public.timesheet_entries
  add column job_id uuid references public.jobs(id) on delete set null;
create index ts_job_idx on public.timesheet_entries(job_id);
