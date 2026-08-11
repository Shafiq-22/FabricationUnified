-- =====================================================================
-- 0042: Soft delete was impossible on every table that used it.
--
-- Each SELECT policy read "... and deleted_at is null". Postgres checks
-- the NEW row of an UPDATE against the SELECT policies as well as the
-- UPDATE policy's WITH CHECK, so setting deleted_at made the row fail its
-- own SELECT policy and the update was refused with
--   42501 new row violates row-level security policy
-- for every user, administrators included. Deleting a document, a
-- procurement line, a consumable, an NCR, an inspection report, an RFQ or
-- a handover item all failed this way. Editing any other column on the
-- same row worked, which is why it read as a permissions quirk rather
-- than a dead code path.
--
-- Only administrators may soft-delete (enforced by guard_soft_delete), so
-- letting administrators see deleted rows makes the operation legal for
-- exactly the people allowed to perform it. Everyone else still cannot
-- see deleted rows, and the app keeps filtering deleted_at in its queries.
-- =====================================================================

do $$
declare r record; v_tier text;
begin
  for r in
    select tablename, policyname, qual
      from pg_policies
     where schemaname='public' and cmd='SELECT' and qual like '%deleted_at IS NULL%'
  loop
    -- Pull the tier out of the existing policy so each table keeps its own.
    v_tier := substring(r.qual from 'auth_user_tier\(\) >= ([0-9]+)');
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((public.auth_user_tier() >= %s and deleted_at is null)
                or public.auth_is_admin())',
      r.policyname, r.tablename, coalesce(v_tier, '1'));
  end loop;
end $$;
