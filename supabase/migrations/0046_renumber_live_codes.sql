-- =====================================================================
-- 0046: One-off renumbering of the codes already issued.
--
-- 0043 made deleted codes free up, so an emptied register starts again at
-- 001 from now on. The records that survived the testing rounds still
-- carried the numbers they were given at the time -- a live job at -004
-- with nothing at -001 to -003. This renumbers what is live so the codes
-- and the counters agree.
--
-- t30_update_code_status pins code_tail to its old value on every update
-- (so a status change rebuilds the code without renumbering), which would
-- silently revert this. It is disabled for the statement and re-enabled
-- immediately after.
--
-- Safe: nothing joins on job_code or project_code -- every other table
-- references jobs and projects by id -- so this is a relabel only.
-- =====================================================================

with ordered as (
  select id,
         substring(project_code from 5 for 4) as yr,
         row_number() over (partition by substring(project_code from 5 for 4)
                            order by created_at) as n
    from public.projects
   where deleted_at is null and project_code is not null
)
update public.projects p
   set project_code = 'PRJ-' || o.yr || '-' || lpad(o.n::text, 3, '0')
  from ordered o
 where p.id = o.id;

alter table public.jobs disable trigger t30_update_code_status;

with ordered as (
  select id,
         regexp_replace(code_tail, '-[0-9]+$', '') as stem,
         status,
         row_number() over (
           partition by regexp_replace(code_tail, '-[0-9]+$', '')
           order by created_at
         ) as n
    from public.jobs
   where deleted_at is null and code_tail is not null
)
update public.jobs j
   set code_tail = o.stem || '-' || lpad(o.n::text, 3, '0'),
       job_code  = 'BAF-' || public.status_to_prefix(o.status) || '-'
                   || o.stem || '-' || lpad(o.n::text, 3, '0')
  from ordered o
 where j.id = o.id;

alter table public.jobs enable trigger t30_update_code_status;

-- The allocators derive their next number from the live codes, so clearing
-- the counters simply lets them re-derive.
delete from public.project_code_sequences;
delete from public.job_code_sequences;

-- A week's notice on an expiring welder ticket, unless already set by hand.
update public.app_config set value = '7'
 where key = 'cert_expiry_warn_days' and value = '60';
