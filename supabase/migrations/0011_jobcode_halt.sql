-- =====================================================================
-- 0011_jobcode_halt: job code uses '/' separator; add Halt (HAL) status.
-- Nomenclature: BAF/{STATUS}/{SITE}/{MON}/{SEQ}
-- =====================================================================
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.jobs'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then execute format('alter table public.jobs drop constraint %I', c); end if;
end $$;

alter table public.jobs
  add constraint jobs_status_check
  check (status in ('quotation','in_progress','completed','delivered','halt'));

create or replace function public.status_to_prefix(p_status text)
returns text language sql immutable set search_path = public as $$
  select case p_status
    when 'quotation'   then 'QTN'
    when 'in_progress' then 'INP'
    when 'completed'   then 'COM'
    when 'delivered'   then 'DEL'
    when 'halt'        then 'HAL'
    else 'QTN' end;
$$;

create or replace function public.set_job_code()
returns trigger language plpgsql security definer set search_path = public as $$
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
  new.code_tail := v_site || '/' || v_month || '/' || lpad(v_seq::text, 3, '0');
  new.job_code  := 'BAF/' || public.status_to_prefix(new.status) || '/' || new.code_tail;
  return new;
end;
$$;

create or replace function public.update_job_code_status()
returns trigger language plpgsql set search_path = public as $$
begin
  new.code_tail := old.code_tail;
  if old.code_tail is not null then
    new.job_code := 'BAF/' || public.status_to_prefix(new.status) || '/' || old.code_tail;
  end if;
  return new;
end;
$$;

revoke execute on function public.status_to_prefix(text) from public, anon;
grant execute on function public.status_to_prefix(text) to authenticated;
revoke execute on function public.set_job_code() from public, anon, authenticated;
revoke execute on function public.update_job_code_status() from public, anon, authenticated;
