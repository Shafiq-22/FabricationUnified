-- =====================================================================
-- 0045: One person, one capacity, one job.
--
-- Assigning the same contact to a job and again to the project that job
-- belongs to produced two entries on the project's People list, because
-- the project view gathers both its own assignments and those of its
-- jobs. Duplicates are now impossible at the source, and the views
-- collapse a job-level and project-level assignment of the same person in
-- the same capacity into a single entry.
--
-- Partial indexes because exactly one of job_id / project_id is set on any
-- given row.
-- =====================================================================

delete from public.contact_assignments a
 using public.contact_assignments b
 where a.ctid > b.ctid
   and a.contact_id = b.contact_id
   and a.role = b.role
   and a.job_id is not distinct from b.job_id
   and a.project_id is not distinct from b.project_id;

create unique index ca_job_unique_idx
  on public.contact_assignments(contact_id, job_id, role)
  where job_id is not null;
create unique index ca_project_unique_idx
  on public.contact_assignments(contact_id, project_id, role)
  where project_id is not null;
