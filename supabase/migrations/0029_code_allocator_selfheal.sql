-- =====================================================================
-- 0029: Make the job/project code allocators self-healing.
--
-- Both allocators treated their counter table as the only authority. If the
-- counter ever falls behind the codes actually in use — a restored row, a
-- reset counter, a partially rolled-back cleanup — the next insert is handed
-- a code that already exists and fails on the unique index, which blocks
-- record creation entirely until someone repairs the counter by hand.
--
-- This was live: project_code_sequences was empty while PRJ-2026-001 existed,
-- so the next project would have failed with a duplicate key.
--
-- The fix takes `greatest(counter, highest code in use) + 1`, so the counter
-- can only ever move forward and a drift repairs itself on the next call.
-- The ON CONFLICT ... RETURNING shape is unchanged, so allocation stays
-- concurrency-safe: the row lock still serialises simultaneous inserts.
-- =====================================================================

create or replace function public.next_project_seq(p_year text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_seq int; v_max int;
begin
  -- Highest sequence already used for this year, deleted rows included: their
  -- codes still occupy the unique index.
  select coalesce(max((regexp_match(project_code, '([0-9]+)$'))[1]::int), 0)
    into v_max
    from public.projects
   where project_code like 'PRJ-' || p_year || '-%';

  insert into public.project_code_sequences(year_key, last_seq)
  values (p_year, v_max + 1)
  on conflict (year_key) do update
    set last_seq = greatest(public.project_code_sequences.last_seq, v_max) + 1
  returning last_seq into v_seq;
  return v_seq;
end;
$$;

create or replace function public.next_job_seq(p_year_month text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_seq int; v_max int;
begin
  -- code_tail is SITE/MON/NNN and is never rewritten after creation, so the
  -- trailing number is the sequence that was actually issued for this period.
  select coalesce(max((regexp_match(code_tail, '([0-9]+)$'))[1]::int), 0)
    into v_max
    from public.jobs
   where code_tail is not null
     and to_char(coalesce(start_date, created_at::date), 'YYYY-MM') = p_year_month;

  insert into public.job_code_sequences(year_month, last_seq)
  values (p_year_month, v_max + 1)
  on conflict (year_month) do update
    set last_seq = greatest(public.job_code_sequences.last_seq, v_max) + 1
  returning last_seq into v_seq;
  return v_seq;
end;
$$;

-- These are called only from the code-setting triggers.
revoke execute on function public.next_project_seq(text) from public, anon, authenticated;
revoke execute on function public.next_job_seq(text)     from public, anon, authenticated;

-- Bring the project counter back in line with the codes already issued.
insert into public.project_code_sequences(year_key, last_seq)
select substring(project_code from 5 for 4),
       max((regexp_match(project_code, '([0-9]+)$'))[1]::int)
  from public.projects
 where project_code is not null
 group by 1
on conflict (year_key) do update
  set last_seq = greatest(public.project_code_sequences.last_seq, excluded.last_seq);
