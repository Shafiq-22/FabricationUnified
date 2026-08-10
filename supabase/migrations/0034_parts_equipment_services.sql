-- =====================================================================
-- 0034: Part-level worksheet lines, plus equipment and service charges.
--
-- 1. Every worksheet line gains part_ref, so a job reads
--    Job -> Part No. / Name -> items rather than one flat list. It is
--    nullable and free text: existing lines keep working and simply sit
--    under an "unassigned" heading until someone fills it in.
--
-- 2. Equipment charges price the machines a job consumes, linked to the
--    Personnel & Equipment register so the bare and with-driver rates come
--    from one place. Free text is still allowed for hired-in plant.
--
-- 3. Service charges cover bought-in work - galvanising, NDT, blasting,
--    transport - which is neither material, labour nor a consumable.
--
-- Both new sections carry their own margin, defaulting to the material
-- margin so nothing about existing quotes changes until they are set.
-- =====================================================================

-- ---- 1. Part / assembly reference ------------------------------------
alter table public.job_quote_materials    add column part_ref text;
alter table public.job_actual_materials   add column part_ref text;
alter table public.job_quote_workforce    add column part_ref text;
alter table public.job_actual_workforce   add column part_ref text;
alter table public.job_quote_consumables  add column part_ref text;
alter table public.job_actual_consumables add column part_ref text;

create index jqm_part_idx on public.job_quote_materials(job_id, part_ref);
create index jam_part_idx on public.job_actual_materials(job_id, part_ref);

-- ---- 2 & 3. New charge sections --------------------------------------
create table public.job_quote_equipment (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  seq_no          int,
  part_ref        text,
  equipment_id    uuid references public.equipment(id) on delete set null,
  description     text,
  with_driver     boolean not null default false,
  hours           numeric(12,2),
  rate_aed_per_hr numeric(12,2),
  total_cost      numeric(14,2) generated always as
                    (coalesce(hours,0) * coalesce(rate_aed_per_hr,0)) stored
);
create table public.job_actual_equipment (like public.job_quote_equipment including all);
alter table public.job_actual_equipment
  add constraint jae_job_fk       foreign key (job_id)       references public.jobs(id) on delete cascade,
  add constraint jae_equipment_fk foreign key (equipment_id) references public.equipment(id) on delete set null;

create table public.job_quote_services (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  seq_no       int,
  part_ref     text,
  service_name text,
  provider     text,
  unit         text,
  qty          numeric(12,2),
  unit_cost    numeric(12,2),
  total_cost   numeric(14,2) generated always as
                 (coalesce(qty,0) * coalesce(unit_cost,0)) stored
);
create table public.job_actual_services (like public.job_quote_services including all);
alter table public.job_actual_services
  add constraint jasvc_job_fk foreign key (job_id) references public.jobs(id) on delete cascade;

create index jqe_job_idx on public.job_quote_equipment(job_id);
create index jae_job_idx on public.job_actual_equipment(job_id);
-- jqs_/jas_ are already taken by the quotation/actual summary tables.
create index jqsvc_job_idx on public.job_quote_services(job_id);
create index jasvc_job_idx on public.job_actual_services(job_id);

-- House pattern: RLS, tier policies, audit, grants.
do $$
declare t text;
begin
  foreach t in array array['job_quote_equipment','job_actual_equipment',
                           'job_quote_services','job_actual_services']
  loop
    execute format('alter table public.%I enable row level security', t);
    -- Money lives on these rows, so reading them is Tier 2+.
    execute format($f$create policy %I on public.%I for select to authenticated
                      using (public.auth_user_tier() >= 2)$f$, t||'_sel', t);
    execute format($f$create policy %I on public.%I for insert to authenticated
                      with check (public.auth_user_tier() >= 2)$f$, t||'_ins', t);
    execute format($f$create policy %I on public.%I for update to authenticated
                      using (public.auth_user_tier() >= 2)
                      with check (public.auth_user_tier() >= 2)$f$, t||'_upd', t);
    execute format($f$create policy %I on public.%I for delete to authenticated
                      using (public.auth_user_tier() >= 2)$f$, t||'_del', t);
    execute format('create trigger z_audit after insert or update or delete on public.%I
                    for each row execute function public.audit_trigger()', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---- Margins for the new sections ------------------------------------
insert into public.app_config(key, value)
select 'equipment_margin', coalesce((select value from public.app_config where key='material_margin'), '15')
where not exists (select 1 from public.app_config where key='equipment_margin');
insert into public.app_config(key, value)
select 'services_margin', coalesce((select value from public.app_config where key='material_margin'), '15')
where not exists (select 1 from public.app_config where key='services_margin');

-- ---- Financials now include equipment and services -------------------
create or replace function public.recompute_job_financials(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  mm numeric; wm numeric; cm numeric; em numeric; sm numeric;
  m_sub numeric; w_sub numeric; c_sub numeric; e_sub numeric; s_sub numeric;
  am_sub numeric; aw_sub numeric; ac_sub numeric; ae_sub numeric; as_sub numeric;
  v_qbm numeric; v_final numeric; v_actual numeric; v_has_actual boolean;
begin
  if public.auth_user_tier() < 2 then
    raise exception 'Not authorized';
  end if;

  select coalesce((select value::numeric from app_config where key='material_margin'),0)    into mm;
  select coalesce((select value::numeric from app_config where key='workforce_margin'),0)   into wm;
  select coalesce((select value::numeric from app_config where key='consumables_margin'),0) into cm;
  select coalesce((select value::numeric from app_config where key='equipment_margin'),0)   into em;
  select coalesce((select value::numeric from app_config where key='services_margin'),0)    into sm;

  select coalesce(sum(total_cost),0) into m_sub from job_quote_materials   where job_id=p_job_id;
  select coalesce(sum(coalesce(total_hours,0)*coalesce(rate_aed_per_hr,0)),0) into w_sub
    from job_quote_workforce where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into c_sub from job_quote_consumables where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into e_sub from job_quote_equipment   where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into s_sub from job_quote_services    where job_id=p_job_id;

  select coalesce(sum(total_cost),0) into am_sub from job_actual_materials  where job_id=p_job_id;
  select coalesce(sum(coalesce(total_hours,0)*coalesce(rate_aed_per_hr,0)),0) into aw_sub
    from job_actual_workforce where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into ac_sub from job_actual_consumables where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into ae_sub from job_actual_equipment   where job_id=p_job_id;
  select coalesce(sum(total_cost),0) into as_sub from job_actual_services    where job_id=p_job_id;

  v_qbm   := m_sub + w_sub + c_sub + e_sub + s_sub;
  v_final := m_sub*(1+mm/100) + w_sub*(1+wm/100) + c_sub*(1+cm/100)
           + e_sub*(1+em/100) + s_sub*(1+sm/100);
  v_actual := am_sub + aw_sub + ac_sub + ae_sub + as_sub;
  v_has_actual := exists(select 1 from job_actual_materials   where job_id=p_job_id)
               or exists(select 1 from job_actual_workforce   where job_id=p_job_id)
               or exists(select 1 from job_actual_consumables where job_id=p_job_id)
               or exists(select 1 from job_actual_equipment   where job_id=p_job_id)
               or exists(select 1 from job_actual_services    where job_id=p_job_id);

  update jobs set
    quote_before_margin = round(v_qbm, 2),
    final_quote         = round(v_final, 2),
    margin              = case when v_qbm = 0 then 0 else round(v_final / v_qbm - 1, 4) end,
    actual_cost         = case when v_has_actual then round(v_actual, 2) else null end,
    profit_loss         = case when v_has_actual then round(v_final - v_actual, 2) else null end,
    pl_percentage       = case when v_has_actual and v_final <> 0
                               then round((v_final - v_actual) / v_final, 4) else null end
  where id = p_job_id;
end;
$$;

-- No recompute trigger here: like the other line tables, the worksheet save
-- action calls recompute_job_financials once after writing all the rows.
