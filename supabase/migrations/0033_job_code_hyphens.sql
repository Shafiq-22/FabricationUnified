-- =====================================================================
-- 0033: One separator in job codes.
--
-- Codes mixed both separators - BAF/INP/OSS-JUN-001 - which reads as two
-- different schemes stuck together and is awkward to type, sort and paste
-- into an email. Everything becomes a hyphen:
--
--   BAF/INP/OSS-JUN-001  ->  BAF-INP-OSS-JUN-001
--
-- Existing codes are rewritten in place. The code is an identifier the shop
-- reads, not a foreign key: nothing joins on it, and job_id is what every
-- other table references, so rewriting is safe. code_tail keeps its own
-- separators in step so status changes rebuild the code correctly.
-- =====================================================================

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
  new.code_tail := v_site || '-' || v_month || '-' || lpad(v_seq::text, 3, '0');
  new.job_code  := 'BAF-' || public.status_to_prefix(new.status) || '-' || new.code_tail;
  return new;
end;
$$;

create or replace function public.update_job_code_status()
returns trigger language plpgsql set search_path = public as $$
begin
  new.code_tail := old.code_tail;
  if old.code_tail is not null then
    new.job_code := 'BAF-' || public.status_to_prefix(new.status) || '-' || old.code_tail;
  end if;
  return new;
end;
$$;

-- Rewrite the codes already issued.
update public.jobs
   set code_tail = replace(code_tail, '/', '-'),
       job_code  = replace(job_code,  '/', '-')
 where job_code like '%/%' or code_tail like '%/%';

-- next_job_seq reads the trailing number of code_tail, which is unchanged by
-- the rewrite, so allocation carries on from where it was.
