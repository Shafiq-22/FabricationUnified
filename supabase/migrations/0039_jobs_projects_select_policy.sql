-- =====================================================================
-- 0039: The SELECT policy that 0031's column grant needed.
--
-- jobs and projects had RLS enabled but no SELECT policy, because reads
-- were meant to go through the masking views. Postgres, however, applies
-- SELECT policies to the rows an UPDATE or DELETE reads through its WHERE
-- clause -- so with no policy every filtered write matched ZERO ROWS and
-- silently did nothing. Deleting a project appeared to succeed and the row
-- stayed; attaching a job to a project did nothing at all.
--
-- 0031 fixed the column privilege half of this; the row policy is the
-- other half. inventory_items already had one, which is why it worked.
--
-- Safe: the money columns are still ungranted at the column level, so
-- `select final_quote from jobs` is refused for Tier 1 regardless of this
-- policy, and the non-financial columns are already visible via jobs_view.
-- =====================================================================

create policy jobs_sel on public.jobs
  for select to authenticated using (public.auth_user_tier() >= 1);

create policy proj_sel on public.projects
  for select to authenticated using (public.auth_user_tier() >= 1);
