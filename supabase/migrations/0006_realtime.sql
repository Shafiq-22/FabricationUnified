-- =====================================================================
-- 0006_realtime: status-event table + realtime publication
-- Realtime streams BASE-table columns, so we never publish `jobs` directly
-- (it carries financials). Instead a finance-free job_status_events row is
-- emitted on status change. job_comments and job_actual_workforce carry no
-- monetary columns, so they are safe to publish directly.
-- =====================================================================

create table public.job_status_events (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  job_code   text,
  status     text,
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index jse_job_idx on public.job_status_events(job_id);
create index jse_created_idx on public.job_status_events(created_at desc);

alter table public.job_status_events enable row level security;
create policy jse_sel on public.job_status_events
  for select to authenticated using (public.auth_user_tier() >= 1);

create or replace function public.emit_job_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.job_status_events(job_id, job_code, status, changed_by)
    values (new.id, new.job_code, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger t60_emit_status after insert or update on public.jobs
  for each row execute function public.emit_job_status_event();

-- Only the trigger writes status events; clients just read.
grant select on public.job_status_events to authenticated;
revoke insert, update, delete on public.job_status_events from authenticated;
revoke all on public.job_status_events from anon;

-- Realtime publication membership.
alter publication supabase_realtime add table public.job_status_events;
alter publication supabase_realtime add table public.job_comments;
alter publication supabase_realtime add table public.job_actual_workforce;
