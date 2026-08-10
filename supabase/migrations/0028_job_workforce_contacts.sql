-- =====================================================================
-- 0028: Workforce that actually worked a job, derived from timesheets.
--
-- The PoC tab shows welders and foremen without anyone re-typing them:
-- they are already on the timesheet, so read them from there. Assigned
-- contacts (project in-charge, requisitioner, procurement) come from
-- contact_assignments; this view supplies the shop-floor half.
--
-- security_invoker = true: no money here, so the caller's own RLS on
-- timesheet_entries / personnel is exactly the policy we want.
-- =====================================================================

create or replace view public.job_workforce_contacts with (security_invoker = true) as
select
  t.job_id,
  p.id           as personnel_id,
  p.name,
  p.trade,
  p.ho_no,
  p.welder_qualification,
  p.qualification_expiry,
  count(distinct t.entry_date)                     as days_worked,
  coalesce(sum(t.normal_hours), 0)                 as normal_hours,
  coalesce(sum(t.ot_hours), 0)                     as ot_hours,
  min(t.entry_date)                                as first_worked,
  max(t.entry_date)                                as last_worked
from public.timesheet_entries t
join public.personnel p on p.id = t.personnel_id
where t.job_id is not null
group by t.job_id, p.id, p.name, p.trade, p.ho_no,
         p.welder_qualification, p.qualification_expiry;

grant select on public.job_workforce_contacts to authenticated;
revoke all  on public.job_workforce_contacts from anon;

create index if not exists timesheet_job_personnel_idx
  on public.timesheet_entries(job_id, personnel_id);
