-- =====================================================================
-- 0053: Per-job Notes (Changes II, item 1).
--
-- Free-text notes against a job, each dated and given a running number so
-- they can be referred to out loud on the floor ("see note 4"). Distinct
-- from job_comments, which is the realtime discussion thread with mentions
-- and notification fan-out -- a note is a record, not a message, and does
-- not notify anyone.
--
-- Numbering is per job and never reuses: seq_no is max+1 across every row
-- for that job including soft-deleted ones, so removing a note leaves a gap
-- rather than renumbering the ones after it. That is the opposite of the
-- job/project code allocators, which deliberately reuse freed numbers --
-- a code names a thing that no longer exists, whereas a numbered note is a
-- reference someone may already have written down.
--
-- Notes are operational, not financial, so every tier can read and write
-- them -- including tier 2, which cannot see the worksheet at all. This is
-- why the panel lives on the job page rather than inside the worksheet tabs.
-- =====================================================================

create table if not exists public.job_notes (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  seq_no      integer not null,
  body        text not null check (length(btrim(body)) > 0),
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists jn_job_idx on public.job_notes (job_id, seq_no desc);

comment on table public.job_notes is
  'Dated, per-job numbered notes. Not the comment thread: no mentions, no notifications.';

-- Running number per job. Counts soft-deleted rows too, so a number is never
-- handed out twice.
create or replace function public.tg_job_note_seq()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.seq_no is null or new.seq_no = 0 then
    select coalesce(max(seq_no), 0) + 1 into new.seq_no
      from public.job_notes where job_id = new.job_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.tg_job_note_seq() from public, anon, authenticated;

create trigger t10_job_note_seq before insert on public.job_notes
  for each row execute function public.tg_job_note_seq();

create trigger t50_set_updated_at before update on public.job_notes
  for each row execute function public.set_updated_at();

create trigger z_audit after insert or delete or update on public.job_notes
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- RLS: readable and writable by every tier; a note may be edited or removed
-- by whoever wrote it, or by an administrator.
-- ---------------------------------------------------------------------
alter table public.job_notes enable row level security;

create policy jn_sel on public.job_notes for select
  using (public.auth_user_tier() >= 1 and (deleted_at is null or public.auth_is_admin()));

create policy jn_ins on public.job_notes for insert
  with check (public.auth_user_tier() >= 1 and created_by = (select auth.uid()));

create policy jn_upd on public.job_notes for update
  using (created_by = (select auth.uid()) or public.auth_is_admin())
  with check (created_by = (select auth.uid()) or public.auth_is_admin());

create policy jn_del on public.job_notes for delete
  using (created_by = (select auth.uid()) or public.auth_is_admin());

revoke all on public.job_notes from anon;
grant select, insert, update, delete on public.job_notes to authenticated;
