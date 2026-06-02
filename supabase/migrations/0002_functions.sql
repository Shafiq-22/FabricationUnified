-- =====================================================================
-- 0002_functions: helper + trigger functions (no triggers attached yet)
-- =====================================================================

-- Current user's role tier (0 if not an active user). SECURITY DEFINER so it
-- bypasses RLS on public.users and never recurses inside users policies.
create or replace function public.auth_user_tier()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role_tier from public.users where id = (select auth.uid()) and active = true),
    0);
$$;

create or replace function public.auth_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_user_tier() = 3;
$$;

-- Touch updated_at on UPDATE.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Generic audit writer. Append-only; runs as definer so it can insert into
-- audit_log even though `authenticated` has no grant there.
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  uuid;
begin
  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old);
  elsif (tg_op = 'UPDATE') then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  else
    v_new := to_jsonb(new);
  end if;

  v_id := nullif(coalesce(v_new ->> 'id', v_old ->> 'id'), '')::uuid;

  insert into public.audit_log(user_id, action, table_name, record_id, old_value, new_value)
  values (auth.uid(), tg_op, tg_table_name, v_id, v_old, v_new);

  return coalesce(new, old);
end;
$$;

-- Map job status -> code prefix.
create or replace function public.status_to_prefix(p_status text)
returns text language sql immutable as $$
  select case p_status
    when 'quotation'   then 'QTN'
    when 'in_progress' then 'INP'
    when 'completed'   then 'COM'
    when 'delivered'   then 'DEL'
    else 'QTN' end;
$$;

-- Atomically allocate the next monthly sequence number (race-safe).
create or replace function public.next_job_seq(p_year_month text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into public.job_code_sequences(year_month, last_seq)
  values (p_year_month, 1)
  on conflict (year_month)
  do update set last_seq = public.job_code_sequences.last_seq + 1
  returning last_seq into v_seq;
  return v_seq;
end;
$$;

-- Compute the three job financial fields together (generated columns can't chain).
create or replace function public.jobs_compute_financials()
returns trigger language plpgsql as $$
begin
  new.final_quote := round(coalesce(new.quote_before_margin,0) * (1 + coalesce(new.margin,0)), 2);
  new.profit_loss := case
    when new.actual_cost is null then null
    else round(new.final_quote - new.actual_cost, 2) end;
  new.pl_percentage := case
    when new.final_quote is null or new.final_quote = 0 or new.profit_loss is null then null
    else round(new.profit_loss / new.final_quote, 4) end;
  return new;
end;
$$;

-- Build BAF-{STATUS}-{SITE}-{MON}-{SEQ} on insert.
create or replace function public.set_job_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text;
  v_month  text;
  v_site   text;
  v_seq    int;
begin
  if new.job_code is not null and new.code_tail is not null then
    return new;
  end if;
  v_period := to_char(coalesce(new.start_date, current_date), 'YYYY-MM');
  v_month  := upper(to_char(coalesce(new.start_date, current_date), 'Mon'));
  select code into v_site from public.sites where id = new.site_id;
  if v_site is null then
    raise exception 'Cannot generate job code: site is required';
  end if;
  v_seq := public.next_job_seq(v_period);
  new.code_tail := v_site || '-' || v_month || '-' || lpad(v_seq::text, 3, '0');
  new.job_code  := 'BAF-' || public.status_to_prefix(new.status) || '-' || new.code_tail;
  return new;
end;
$$;

-- Keep code_tail immutable; only the status prefix follows status changes.
create or replace function public.update_job_code_status()
returns trigger language plpgsql as $$
begin
  new.code_tail := old.code_tail;
  if old.code_tail is not null then
    new.job_code := 'BAF-' || public.status_to_prefix(new.status) || '-' || old.code_tail;
  end if;
  return new;
end;
$$;

-- Only admins (tier 3) may change a record's soft-delete state.
create or replace function public.guard_soft_delete()
returns trigger language plpgsql as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    if public.auth_user_tier() < 3 then
      raise exception 'Only administrators may delete or restore records';
    end if;
  end if;
  return new;
end;
$$;

-- Never allow the last active administrator to be removed/demoted.
create or replace function public.guard_last_admin()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if (old.role_tier = 3 and old.active)
       and (new.role_tier <> 3 or new.active = false) then
      if (select count(*) from public.users
          where role_tier = 3 and active and id <> old.id) = 0 then
        raise exception 'Cannot remove the last active administrator';
      end if;
    end if;
    return new;
  else
    if old.role_tier = 3 and old.active then
      if (select count(*) from public.users
          where role_tier = 3 and active and id <> old.id) = 0 then
        raise exception 'Cannot remove the last active administrator';
      end if;
    end if;
    return old;
  end if;
end;
$$;

-- Admin-only RPC to create an auth user + profile (avoids needing the
-- service-role key in the app). Sets a temporary password the admin shares.
create or replace function public.admin_create_user(
  p_email text, p_password text, p_full_name text, p_tier int
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid := gen_random_uuid();
begin
  if not public.auth_is_admin() then
    raise exception 'Only administrators may create users';
  end if;
  if p_tier not in (1,2,3) then
    raise exception 'Invalid role tier';
  end if;
  if length(coalesce(p_password,'')) < 8 then
    raise exception 'Temporary password must be at least 8 characters';
  end if;
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'A user with this email already exists';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider','email','providers', array['email']),
    jsonb_build_object('full_name', p_full_name),
    false, false
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_uid::text,
    jsonb_build_object('sub', v_uid::text, 'email', lower(p_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.users (id, full_name, email, role_tier, active)
  values (v_uid, p_full_name, lower(p_email), p_tier, true);

  return v_uid;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, int) from public, anon;
grant execute on function public.admin_create_user(text, text, text, int) to authenticated;
