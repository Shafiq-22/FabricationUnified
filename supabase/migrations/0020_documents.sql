-- =====================================================================
-- 0020: Documents & Supabase Storage.
-- Files live in a private `documents` bucket; this table is the index.
-- The existing `drawings` table is untouched (it tracks handover drawing
-- submissions, a different concern).
-- project_id is declared nullable here and wired to the projects table in
-- migration 0021; keeping it now avoids a second ALTER on the same table.
-- =====================================================================

create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid references public.jobs(id) on delete cascade,
  project_id        uuid,   -- FK added in 0021 once projects exists
  doc_type          text not null default 'other'
                      check (doc_type in ('drawing','invoice','po','inspection_report','photo','email','other')),
  title             text,
  file_path         text not null,          -- storage object path within the bucket
  original_filename text,
  mime_type         text,
  size_bytes        bigint,
  revision          text,
  notes             text,
  uploaded_by       uuid references public.users(id),
  uploaded_at       timestamptz not null default now(),
  deleted_at        timestamptz
);
create index doc_job_idx     on public.documents(job_id);
create index doc_project_idx on public.documents(project_id);
create index doc_type_idx    on public.documents(doc_type);
create index doc_uploaded_idx on public.documents(uploaded_at desc);

alter table public.documents enable row level security;
create policy doc_sel on public.documents for select to authenticated
  using (public.auth_user_tier() >= 1 and deleted_at is null);
create policy doc_ins on public.documents for insert to authenticated
  with check (public.auth_user_tier() >= 2);
create policy doc_upd on public.documents for update to authenticated
  using ((public.auth_user_tier() >= 2 and deleted_at is null) or public.auth_is_admin())
  with check (public.auth_user_tier() >= 2);
create policy doc_del on public.documents for delete to authenticated
  using (public.auth_is_admin());

create trigger t40_guard_soft_delete before update on public.documents
  for each row execute function public.guard_soft_delete();
create trigger z_audit after insert or update or delete on public.documents
  for each row execute function public.audit_trigger();

grant select, insert, update, delete on public.documents to authenticated;
revoke all on public.documents from anon;

-- ---- Storage bucket + object policies -------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Signed URLs are issued server-side; objects are never publicly readable.
drop policy if exists documents_read   on storage.objects;
drop policy if exists documents_write  on storage.objects;
drop policy if exists documents_update on storage.objects;
drop policy if exists documents_delete on storage.objects;

create policy documents_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.auth_user_tier() >= 1);
create policy documents_write on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.auth_user_tier() >= 2);
create policy documents_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.auth_user_tier() >= 2);
create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.auth_is_admin());
