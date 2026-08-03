-- =====================================================================
-- 0022: Clients -> Projects -> RFQs.
-- The hierarchy sits ABOVE existing jobs: jobs.project_id is nullable, so
-- every current job keeps working untouched and the site-based model is
-- unchanged. projects.contract_value is masked from Tier 1 by projects_view,
-- mirroring the jobs/jobs_view arrangement.
-- =====================================================================

create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  contact_email text,
  contact_phone text,
  address       text,
  active        boolean not null default true,
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now()
);
create unique index clients_name_uidx on public.clients (lower(name));

create table public.projects (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references public.clients(id) on delete set null,
  site_id           uuid references public.sites(id),
  name              text not null,
  project_code      text unique,
  status            text not null default 'rfq'
                      check (status in ('rfq','quoted','won','in_fabrication','qa','dispatch','installed','closed','lost')),
  contract_value    numeric(14,2),
  start_date        date,
  target_completion date,
  actual_completion date,
  notes             text,
  created_by        uuid references public.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index proj_client_idx on public.projects(client_id);
create index proj_site_idx   on public.projects(site_id);
create index proj_status_idx on public.projects(status);

-- Concurrency-safe project codes: PRJ-YYYY-NNN, reusing the allocator pattern
-- proven for job codes.
create table public.project_code_sequences (
  year_key text primary key,
  last_seq int not null default 0
);

create or replace function public.next_project_seq(p_year text)
returns int language plpgsql security definer set search_path = public as $$
declare v_seq int;
begin
  insert into public.project_code_sequences(year_key, last_seq)
  values (p_year, 1)
  on conflict (year_key)
  do update set last_seq = public.project_code_sequences.last_seq + 1
  returning last_seq into v_seq;
  return v_seq;
end;
$$;

create or replace function public.set_project_code()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_year text; v_seq int;
begin
  if new.project_code is not null then return new; end if;
  v_year := to_char(coalesce(new.start_date, current_date), 'YYYY');
  v_seq  := public.next_project_seq(v_year);
  new.project_code := 'PRJ-' || v_year || '-' || lpad(v_seq::text, 3, '0');
  return new;
end;
$$;

create trigger t10_set_project_code before insert on public.projects
  for each row execute function public.set_project_code();
create trigger t40_guard_soft_delete before update on public.projects
  for each row execute function public.guard_soft_delete();
create trigger t50_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.rfqs (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete set null,
  project_id    uuid references public.projects(id) on delete set null,
  job_id        uuid references public.jobs(id) on delete set null,
  title         text not null,
  received_date date,
  due_date      date,
  status        text not null default 'open'
                  check (status in ('open','quoted','won','lost','cancelled')),
  notes         text,
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index rfq_client_idx  on public.rfqs(client_id);
create index rfq_project_idx on public.rfqs(project_id);
create index rfq_status_idx  on public.rfqs(status);
create index rfq_due_idx     on public.rfqs(due_date);

create trigger t40_guard_soft_delete before update on public.rfqs
  for each row execute function public.guard_soft_delete();
create trigger t50_set_updated_at before update on public.rfqs
  for each row execute function public.set_updated_at();

-- ---- Link existing entities (both nullable => non-breaking) ---------
alter table public.jobs      add column project_id uuid references public.projects(id) on delete set null;
create index jobs_project_idx on public.jobs(project_id);
alter table public.documents add constraint documents_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete set null;

-- ---- RLS ------------------------------------------------------------
alter table public.clients enable row level security;
create policy cli_sel on public.clients for select to authenticated using (public.auth_user_tier() >= 1);
create policy cli_ins on public.clients for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy cli_upd on public.clients for update to authenticated using (public.auth_user_tier() >= 2) with check (public.auth_user_tier() >= 2);
create policy cli_del on public.clients for delete to authenticated using (public.auth_is_admin());

alter table public.projects enable row level security;
create policy proj_ins on public.projects for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy proj_upd on public.projects for update to authenticated
  using ((public.auth_user_tier() >= 2 and deleted_at is null) or public.auth_is_admin())
  with check (public.auth_user_tier() >= 2);
create policy proj_del on public.projects for delete to authenticated using (public.auth_is_admin());

alter table public.rfqs enable row level security;
create policy rfq_sel on public.rfqs for select to authenticated using (public.auth_user_tier() >= 1 and deleted_at is null);
create policy rfq_ins on public.rfqs for insert to authenticated with check (public.auth_user_tier() >= 2);
create policy rfq_upd on public.rfqs for update to authenticated
  using ((public.auth_user_tier() >= 2 and deleted_at is null) or public.auth_is_admin())
  with check (public.auth_user_tier() >= 2);
create policy rfq_del on public.rfqs for delete to authenticated using (public.auth_is_admin());

alter table public.project_code_sequences enable row level security;

create trigger z_audit after insert or update or delete on public.clients
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.projects
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.rfqs
  for each row execute function public.audit_trigger();

-- ---- Masking view: only read path for projects ----------------------
create or replace view public.projects_view with (security_invoker = false) as
select
  p.id, p.client_id, c.name as client_name,
  p.site_id, s.code as site_code, s.name as site_name,
  p.name, p.project_code, p.status,
  case when public.auth_user_tier() >= 2 then p.contract_value end as contract_value,
  p.start_date, p.target_completion, p.actual_completion, p.notes,
  p.created_by, p.created_at, p.updated_at,
  (select count(*) from public.jobs j where j.project_id = p.id and j.deleted_at is null) as job_count
from public.projects p
left join public.clients c on c.id = p.client_id
left join public.sites   s on s.id = p.site_id
where p.deleted_at is null;

-- ---- Grants ---------------------------------------------------------
grant select, insert, update, delete on public.clients  to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.rfqs     to authenticated;
revoke select on public.projects from authenticated;   -- reads go via projects_view
grant select on public.projects_view to authenticated;
revoke all on public.clients  from anon;
revoke all on public.projects from anon;
revoke all on public.rfqs     from anon;
revoke all on public.project_code_sequences from authenticated, anon;
revoke execute on function public.next_project_seq(text) from public, anon, authenticated;
revoke execute on function public.set_project_code()     from public, anon, authenticated;
