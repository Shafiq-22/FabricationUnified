-- =====================================================================
-- 0027: Point of Contact registry, derived project values, and the
-- grade/dimension columns the shop asked for.
--
-- `clients` is repurposed rather than dropped: it is empty, and keeping the
-- table means projects.client_id and every existing policy/FK stay valid.
-- =====================================================================

-- ---- Point of Contact ------------------------------------------------
create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  role         text not null default 'other'
                 check (role in ('project_incharge','requisitioner','procurement',
                                 'foreman','engineer','inspector','supplier_rep','other')),
  organisation text,
  email        text,
  phone        text,
  site_id      uuid references public.sites(id) on delete set null,
  personnel_id uuid references public.personnel(id) on delete set null, -- if they are also workforce
  notes        text,
  active       boolean not null default true,
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index contacts_site_idx on public.contacts(site_id);
create index contacts_role_idx on public.contacts(role);

-- Who is involved in which job/project, and in what capacity.
create table public.contact_assignments (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  job_id     uuid references public.jobs(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  role       text not null default 'other'
               check (role in ('project_incharge','requisitioner','procurement',
                               'foreman','engineer','inspector','supplier_rep','other')),
  note       text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  -- An assignment must attach to something.
  constraint contact_assignment_target check (job_id is not null or project_id is not null)
);
create index ca_contact_idx on public.contact_assignments(contact_id);
create index ca_job_idx     on public.contact_assignments(job_id);
create index ca_project_idx on public.contact_assignments(project_id);

create trigger t50_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;
create policy con_sel on public.contacts for select to authenticated using (public.auth_user_tier() >= 1);
create policy con_ins on public.contacts for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy con_upd on public.contacts for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy con_del on public.contacts for delete to authenticated using (public.auth_is_admin());

alter table public.contact_assignments enable row level security;
create policy ca_sel on public.contact_assignments for select to authenticated using (public.auth_user_tier() >= 1);
create policy ca_ins on public.contact_assignments for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy ca_upd on public.contact_assignments for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy ca_del on public.contact_assignments for delete to authenticated using (public.auth_user_tier() >= 2);

create trigger z_audit after insert or update or delete on public.contacts
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.contact_assignments
  for each row execute function public.audit_trigger();

grant select, insert, update, delete on public.contacts            to authenticated;
grant select, insert, update, delete on public.contact_assignments to authenticated;
revoke all on public.contacts            from anon;
revoke all on public.contact_assignments from anon;

-- ---- Shop-floor columns ---------------------------------------------
-- Steel grade belongs on the plate cut list and the section cut list.
alter table public.cut_list_plates  add column grade text;
alter table public.rough_sheet_items add column grade text;
-- Material MTO needs a dimension alongside the description.
alter table public.job_quote_materials  add column dimension text;
alter table public.job_actual_materials add column dimension text;

-- ---- Documents: one record, visible from job AND project -------------
-- Setting project_id from the job keeps a single row (no duplication) while
-- letting the Documents/Projects tabs group by Project -> Job.
create or replace function public.tg_document_sync_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.job_id is not null then
    select j.project_id into new.project_id from public.jobs j where j.id = new.job_id;
  end if;
  return new;
end;
$$;

create trigger t10_sync_project before insert or update of job_id on public.documents
  for each row execute function public.tg_document_sync_project();

-- Re-point existing documents, and keep them aligned when a job moves project.
update public.documents d
   set project_id = j.project_id
  from public.jobs j
 where j.id = d.job_id;

create or replace function public.tg_job_project_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.project_id is distinct from old.project_id then
    update public.documents set project_id = new.project_id where job_id = new.id;
  end if;
  return new;
end;
$$;

create trigger t60_job_project_changed after update of project_id on public.jobs
  for each row execute function public.tg_job_project_changed();

revoke execute on function public.tg_document_sync_project() from public, anon, authenticated;
revoke execute on function public.tg_job_project_changed()   from public, anon, authenticated;

-- ---- Projects: values derived from their jobs ------------------------
-- quoted_value / actual_value roll up from the jobs assigned to the project,
-- so they update as jobs are quoted and completed. contract_value remains as
-- an optional manual figure and is still masked from Tier 1.
create or replace view public.projects_view with (security_invoker = false) as
select
  p.id, p.client_id, c.name as client_name,
  p.site_id, s.code as site_code, s.name as site_name,
  p.name, p.project_code, p.status,
  case when public.auth_user_tier() >= 2 then p.contract_value end as contract_value,
  p.start_date, p.target_completion, p.actual_completion, p.notes,
  p.created_by, p.created_at, p.updated_at,
  (select count(*) from public.jobs j where j.project_id = p.id and j.deleted_at is null) as job_count,
  case when public.auth_user_tier() >= 2 then
    (select coalesce(sum(j.final_quote), 0) from public.jobs j
      where j.project_id = p.id and j.deleted_at is null) end as quoted_value,
  case when public.auth_user_tier() >= 2 then
    (select coalesce(sum(j.actual_cost), 0) from public.jobs j
      where j.project_id = p.id and j.deleted_at is null) end as actual_value,
  (select count(*) from public.jobs j
    where j.project_id = p.id and j.deleted_at is null and j.status in ('completed','delivered')) as completed_job_count
from public.projects p
left join public.clients c on c.id = p.client_id
left join public.sites   s on s.id = p.site_id
where p.deleted_at is null;
