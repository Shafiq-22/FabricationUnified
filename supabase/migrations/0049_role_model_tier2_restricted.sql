-- =====================================================================
-- 0049: Re-cut the three tiers (Changes I, item 2).
--
-- Until now tier 1 was the restricted role: read-only, no money. The
-- department asked for the opposite shape --
--
--   Tier 1  full access, including financials
--   Tier 2  full operational edit, NO financials, may delete inside a
--           job it is assigned to
--   Tier 3  full access, including financials
--
-- so tier 2 becomes the only restricted tier and tiers 1 and 3 are peers.
-- Three consequences, all handled here:
--
--  1. Money was revealed by `auth_user_tier() >= 2`. It is now revealed by
--     `auth_can_see_money()` = tier in (1,3). The predicate lives in one
--     function this time so the next change is a one-liner rather than a
--     sweep through every view.
--
--  2. `auth_user_tier() >= 2` was also the "may edit" predicate on ~90
--     policies. With every tier now an editor that test wrongly locks out
--     tier 1, so it drops to `>= 1` on operational tables. The worksheet
--     tables are the exception: they are nothing but costs, so they move
--     to `auth_can_see_money()` and tier 2 loses them outright, exactly as
--     tier 1 used to.
--
--  3. "Assigned" has no schema of its own. Rather than invent one, it
--     reuses `job_collaborators()` -- the job's creator, anyone who has
--     commented, staff linked through a timesheet, and explicit watchers.
--
-- NOTE the soft-delete trap from 0042 applies again: a tier-2 user setting
-- deleted_at must still satisfy the SELECT policy on the *new* row, so the
-- job-scoped tables below admit `auth_can_act_on_job(job_id)` without the
-- `deleted_at is null` qualifier, the same escape `auth_is_admin()` gets.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Predicates
-- ---------------------------------------------------------------------

-- Money is visible to everyone except tier 2.
create or replace function public.auth_can_see_money()
returns boolean language sql stable security definer set search_path = public as $$
  select public.auth_user_tier() in (1, 3);
$$;

-- Tier 1 joins tier 3 as an administrator.
create or replace function public.auth_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.auth_user_tier() in (1, 3);
$$;

-- May the caller act on this job? Administrators anywhere; tier 2 only on
-- jobs it collaborates on. SECURITY DEFINER because job_collaborators has
-- EXECUTE revoked from client roles and policies run as the caller.
create or replace function public.auth_can_act_on_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_job_id is not null
     and (
       public.auth_is_admin()
       or (
         public.auth_user_tier() = 2
         and (select auth.uid()) in (select public.job_collaborators(p_job_id))
       )
     );
$$;

-- A newly created function grants EXECUTE to PUBLIC by default, which would
-- leave these callable by the anon role over /rest/v1/rpc. Revoke first, then
-- grant only to signed-in users -- the same shape as the other auth helpers.
revoke execute on function public.auth_can_act_on_job(uuid) from public, anon;
grant  execute on function public.auth_can_act_on_job(uuid) to authenticated;
revoke execute on function public.auth_can_see_money() from public, anon;
grant  execute on function public.auth_can_see_money() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Masking views, now keyed on auth_can_see_money()
-- ---------------------------------------------------------------------

create or replace view public.jobs_view with (security_invoker = false) as
select j.id, j.job_code, j.code_tail, j.company_job_code, j.quotation_ref,
       j.status, j.site_id, s.code as site_code, s.name as site_name,
       j.description, j.unit, j.qty, j.start_date, j.completion_date,
       case when public.auth_can_see_money() then j.charge_to_site end      as charge_to_site,
       case when public.auth_can_see_money() then j.quote_before_margin end as quote_before_margin,
       case when public.auth_can_see_money() then j.margin end              as margin,
       case when public.auth_can_see_money() then j.final_quote end         as final_quote,
       case when public.auth_can_see_money() then j.actual_cost end         as actual_cost,
       case when public.auth_can_see_money() then j.profit_loss end         as profit_loss,
       case when public.auth_can_see_money() then j.pl_percentage end       as pl_percentage,
       j.requisition_no, j.lpo_ref, j.inbound_outpass, j.exit_outpass,
       j.comments, j.created_by, u.full_name as created_by_name,
       j.created_at, j.updated_at, j.project_id
  from public.jobs j
  left join public.sites s on s.id = j.site_id
  left join public.users u on u.id = j.created_by
 where j.deleted_at is null;

create or replace view public.projects_view with (security_invoker = false) as
select p.id, p.client_id, c.name as client_name, p.site_id,
       s.code as site_code, s.name as site_name, p.name, p.project_code, p.status,
       case when public.auth_can_see_money() then p.contract_value end as contract_value,
       p.start_date, p.target_completion, p.actual_completion, p.notes,
       p.created_by, p.created_at, p.updated_at,
       (select count(*) from public.jobs j
         where j.project_id = p.id and j.deleted_at is null) as job_count,
       case when public.auth_can_see_money() then
         (select coalesce(sum(j.final_quote), 0) from public.jobs j
           where j.project_id = p.id and j.deleted_at is null) end as quoted_value,
       case when public.auth_can_see_money() then
         (select coalesce(sum(j.actual_cost), 0) from public.jobs j
           where j.project_id = p.id and j.deleted_at is null) end as actual_value,
       (select count(*) from public.jobs j
         where j.project_id = p.id and j.deleted_at is null
           and j.status = any (array['completed','delivered'])) as completed_job_count
  from public.projects p
  left join public.clients c on c.id = p.client_id
  left join public.sites s on s.id = p.site_id
 where p.deleted_at is null;

create or replace view public.inventory_items_view with (security_invoker = false) as
select i.id, i.item_code, i.item_type, i.description, i.material_grade,
       i.dimensions, i.unit, i.quantity_on_hand, i.reorder_threshold,
       i.warehouse_location,
       case when public.auth_can_see_money() then i.unit_cost end as unit_cost,
       case when public.auth_can_see_money()
            then round(i.quantity_on_hand * coalesce(i.unit_cost, 0), 2) end as stock_value,
       i.parent_item_id, i.source_job_id, j.job_code as source_job_code,
       i.active, i.created_at, i.updated_at,
       (i.reorder_threshold is not null and i.quantity_on_hand <= i.reorder_threshold) as low_stock
  from public.inventory_items i
  left join public.jobs j on j.id = i.source_job_id;

-- ---------------------------------------------------------------------
-- 3. Re-point the ~90 "may edit" policies.
--
-- Done by rewriting the stored expressions rather than by hand, so no
-- policy is missed and none is retyped wrongly. Worksheet tables (pure
-- cost data) go to auth_can_see_money(); everything else drops to >= 1.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  money_tables constant text[] := array[
    'job_quote_materials','job_quote_workforce','job_quote_consumables',
    'job_quote_equipment','job_quote_services','job_quotation_summary',
    'job_actual_materials','job_actual_workforce','job_actual_consumables',
    'job_actual_equipment','job_actual_services','job_actual_summary'
  ];
  replacement text;
  new_qual text;
  new_check text;
  stmt text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (qual like '%auth_user_tier() >= 2%' or with_check like '%auth_user_tier() >= 2%')
  loop
    replacement := case when r.tablename = any (money_tables)
                        then 'public.auth_can_see_money()'
                        else 'public.auth_user_tier() >= 1' end;

    new_qual  := replace(r.qual,       'auth_user_tier() >= 2', replacement);
    new_check := replace(r.with_check, 'auth_user_tier() >= 2', replacement);

    stmt := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if new_qual  is not null then stmt := stmt || format(' using (%s)', new_qual); end if;
    if new_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    execute stmt;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Tier 2 may delete inside a job it is assigned to.
--
-- These tables all soft-delete, so the SELECT and UPDATE policies must let
-- the caller keep seeing the row once deleted_at is set -- otherwise the
-- update matches zero rows and fails silently (the 0042 lesson).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  scoped constant text[] := array[
    'documents','job_materials','consumables','handover_items',
    'inspection_reports','ncrs','rfqs'
  ];
  r record;
begin
  foreach t in array scoped loop
    for r in
      select policyname, cmd, qual, with_check
        from pg_policies
       where schemaname='public' and tablename=t and cmd in ('SELECT','UPDATE','DELETE')
    loop
      execute format('alter policy %I on public.%I%s%s',
        r.policyname, t,
        case when r.qual is not null
             then format(' using (%s or public.auth_can_act_on_job(job_id))', r.qual)
             else '' end,
        case when r.with_check is not null
             then format(' with check (%s or public.auth_can_act_on_job(job_id))', r.with_check)
             else '' end);
    end loop;
  end loop;
end $$;

-- The last-admin guard counted tier 3 only. Now that tier 1 is an
-- administrator too, a lone tier-1 admin could otherwise be demoted and lock
-- everybody out of user management.
create or replace function public.guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if (old.role_tier in (1,3) and old.active)
       and (new.role_tier not in (1,3) or new.active = false) then
      if (select count(*) from public.users
           where role_tier in (1,3) and active and id <> old.id) = 0 then
        raise exception 'Cannot remove the last active administrator';
      end if;
    end if;
    return new;
  else
    if old.role_tier in (1,3) and old.active then
      if (select count(*) from public.users
           where role_tier in (1,3) and active and id <> old.id) = 0 then
        raise exception 'Cannot remove the last active administrator';
      end if;
    end if;
    return old;
  end if;
end;
$$;

-- The generic soft-delete guard now admits tier 2 on its own jobs. Tables
-- without a job_id (jobs, projects themselves) stay administrator-only,
-- since to_jsonb(new)->>'job_id' is null for them.
create or replace function public.guard_soft_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job uuid;
begin
  if new.deleted_at is distinct from old.deleted_at then
    if public.auth_is_admin() then
      return new;
    end if;
    if public.auth_user_tier() = 2 then
      v_job := nullif(to_jsonb(new) ->> 'job_id', '')::uuid;
      if public.auth_can_act_on_job(v_job) then
        return new;
      end if;
    end if;
    raise exception
      'Only administrators may delete or restore records, or Tier 2 within a job it is assigned to';
  end if;
  return new;
end;
$$;
