-- =====================================================================
-- 0041: Job collaborators, @ mentions and an in-app notification inbox.
--
-- Delivery is in-app only: the app has no outbound mail path, and every
-- e-mail it produces elsewhere is a mailto: draft the user sends from
-- their own client. Notifications have to arrive on their own, so they
-- land in a bell in the topbar instead.
--
-- Collaborators are derived from what the app already knows rather than
-- maintained by hand: who raised the job, who has commented on it, who
-- booked time to it and has a login, plus anyone who explicitly watches.
-- =====================================================================

alter table public.personnel
  add column user_id uuid references public.users(id) on delete set null;
create index personnel_user_idx on public.personnel(user_id);

create table public.job_watchers (
  job_id     uuid not null references public.jobs(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  watching   boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (job_id, user_id)
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  kind       text not null default 'comment'
               check (kind in ('comment','mention','system')),
  job_id     uuid references public.jobs(id) on delete cascade,
  comment_id uuid references public.job_comments(id) on delete cascade,
  actor_id   uuid references public.users(id) on delete set null,
  title      text not null,
  body       text,
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notif_user_unread_idx on public.notifications(user_id, read_at, created_at desc);

alter table public.job_comments add column mentions uuid[];

create or replace function public.job_collaborators(p_job_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select created_by from public.jobs where id = p_job_id and created_by is not null
  union
  select user_id from public.job_comments where job_id = p_job_id and user_id is not null
  union
  select p.user_id
    from public.timesheet_entries t
    join public.personnel p on p.id = t.personnel_id
   where t.job_id = p_job_id and p.user_id is not null
  union
  select user_id from public.job_watchers where job_id = p_job_id and watching;
$$;

-- Definer helper called only by the trigger below. Left exposed it is an
-- anon-callable RPC that enumerates user ids for any job id.
revoke execute on function public.job_collaborators(uuid) from public, anon, authenticated;

create or replace function public.tg_notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code  text;
  v_actor text;
  v_named boolean := new.mentions is not null and array_length(new.mentions, 1) > 0;
begin
  select job_code into v_code from public.jobs where id = new.job_id;
  select full_name into v_actor from public.users where id = new.user_id;

  insert into public.notifications (user_id, kind, job_id, comment_id, actor_id, title, body, href)
  select r.uid,
         case when v_named then 'mention' else 'comment' end,
         new.job_id, new.id, new.user_id,
         case when v_named
              then coalesce(v_actor,'Someone') || ' mentioned you on ' || coalesce(v_code,'a job')
              else coalesce(v_actor,'Someone') || ' commented on ' || coalesce(v_code,'a job') end,
         left(new.body, 280),
         '/jobs/' || new.job_id || '/worksheet'
    from (
      select unnest(new.mentions) as uid where v_named
      union
      select c.uid from public.job_collaborators(new.job_id) c(uid) where not v_named
    ) r
   where r.uid is not null
     and r.uid <> new.user_id
     -- An explicit unwatch silences the broadcast, but never a direct mention.
     and (v_named or not exists (
       select 1 from public.job_watchers w
        where w.job_id = new.job_id and w.user_id = r.uid and not w.watching));

  return new;
end;
$$;

create trigger t80_notify after insert on public.job_comments
  for each row execute function public.tg_notify_comment();

revoke execute on function public.tg_notify_comment() from public, anon, authenticated;

alter table public.notifications enable row level security;
-- Your inbox is yours: no policy lets one user read another's.
create policy notif_sel on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notif_upd on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_del on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
-- Rows are written only by the definer trigger, so there is no insert policy.

alter table public.job_watchers enable row level security;
create policy jw_sel on public.job_watchers for select to authenticated
  using (public.auth_user_tier() >= 1);
create policy jw_ins on public.job_watchers for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy jw_upd on public.job_watchers for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy jw_del on public.job_watchers for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.job_watchers to authenticated;
revoke all on public.notifications from anon;
revoke all on public.job_watchers  from anon;

create trigger z_audit after insert or update or delete on public.job_watchers
  for each row execute function public.audit_trigger();

-- Without this the bell only updates on a page load. RLS still applies to
-- the stream, so a subscriber receives only their own rows.
alter publication supabase_realtime add table public.notifications;
