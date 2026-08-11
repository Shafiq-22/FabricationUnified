-- =====================================================================
-- 0040: Welder certificates, personnel site, and transfers.
--
-- 1. Personnel carry the site they are currently deployed to. The
--    "Qualification" column is relabelled "Position" in the UI - the
--    stored column keeps its name so nothing else has to move.
--
-- 2. welder_certificates records each certified position with its issue,
--    renewal and expiry dates, so an expiring ticket can be spotted
--    before the welder is stood down. ISO 3834-2 traceability.
--
-- 3. personnel_transfers records a request to move someone between
--    sites. Completing a transfer moves the person, by trigger, so the
--    record and the roster cannot disagree.
-- =====================================================================

alter table public.personnel
  add column site_id uuid references public.sites(id) on delete set null;
create index personnel_site_idx on public.personnel(site_id);

create table public.welder_certificates (
  id             uuid primary key default gen_random_uuid(),
  personnel_id   uuid references public.personnel(id) on delete set null,
  ho_no          text,
  name           text not null,
  position       text,
  certificate_no text,
  issued_on      date,
  renewed_on     date,
  expires_on     date,
  site_id        uuid references public.sites(id) on delete set null,
  issuer         text,
  notes          text,
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index wc_expiry_idx    on public.welder_certificates(expires_on);
create index wc_personnel_idx on public.welder_certificates(personnel_id);
create index wc_site_idx      on public.welder_certificates(site_id);

create trigger t50_set_updated_at before update on public.welder_certificates
  for each row execute function public.set_updated_at();

create table public.personnel_transfers (
  id            uuid primary key default gen_random_uuid(),
  personnel_id  uuid not null references public.personnel(id) on delete cascade,
  from_site_id  uuid references public.sites(id) on delete set null,
  to_site_id    uuid references public.sites(id) on delete set null,
  requested_on  date not null default current_date,
  effective_on  date,
  status        text not null default 'requested'
                  check (status in ('requested','approved','completed','rejected','cancelled')),
  reason        text,
  notes         text,
  requested_by  uuid references public.users(id),
  decided_by    uuid references public.users(id),
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index pt_personnel_idx on public.personnel_transfers(personnel_id);
create index pt_status_idx    on public.personnel_transfers(status);

create trigger t50_set_updated_at before update on public.personnel_transfers
  for each row execute function public.set_updated_at();

create or replace function public.tg_apply_transfer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.personnel set site_id = new.to_site_id where id = new.personnel_id;
  end if;
  return new;
end;
$$;
create trigger t70_apply_transfer after update of status on public.personnel_transfers
  for each row execute function public.tg_apply_transfer();
revoke execute on function public.tg_apply_transfer() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['welder_certificates','personnel_transfers']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy %I on public.%I for select to authenticated
                      using (public.auth_user_tier() >= 1)$f$, t||'_sel', t);
    execute format($f$create policy %I on public.%I for insert to authenticated
                      with check (public.auth_user_tier() >= 2)$f$, t||'_ins', t);
    execute format($f$create policy %I on public.%I for update to authenticated
                      using (public.auth_user_tier() >= 2)
                      with check (public.auth_user_tier() >= 2)$f$, t||'_upd', t);
    execute format($f$create policy %I on public.%I for delete to authenticated
                      using (public.auth_is_admin())$f$, t||'_del', t);
    execute format('create trigger z_audit after insert or update or delete on public.%I
                    for each row execute function public.audit_trigger()', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

insert into public.app_config(key, value)
select 'cert_expiry_notify_email', ''
where not exists (select 1 from public.app_config where key='cert_expiry_notify_email');
insert into public.app_config(key, value)
select 'cert_expiry_warn_days', '60'
where not exists (select 1 from public.app_config where key='cert_expiry_warn_days');
