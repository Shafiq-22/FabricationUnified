-- =====================================================================
-- 0059: Manufacturing Data Book (MDB) per job.
--
-- An MDB is the dossier handed to the client on completion: the index of
-- every certificate, report and drawing that proves the item was built and
-- tested as specified. The shop currently assembles these by hand from a
-- Word template, which is why the structure here follows the standard
-- 12-chapter / 52-section layout rather than inventing one.
--
-- Three tables:
--   job_mdb                     the book's header (one per job)
--   job_mdb_sections            its chapters, seeded from the catalogue in
--                               lib/mdb/template.ts and editable per job
--   job_mdb_section_documents   evidence already in the Documents module,
--                               linked to the section it belongs under
--
-- The section rows are stored rather than derived so a job can drop the
-- chapters that do not apply to it, reorder them, and add its own -- the
-- catalogue is a starting point, not a fixed schema.
--
-- An MDB is a quality record, not a financial one, so every tier may read
-- and write it. Tier 2 (which cannot see the worksheet at all) is usually
-- the role that compiles the book, so gating this on money access would
-- put it out of reach of the people who do the work.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Header
-- ---------------------------------------------------------------------
create table if not exists public.job_mdb (
  id                      uuid primary key default gen_random_uuid(),
  -- One book per job. A revision is a field on the book, not a new row:
  -- the MDB is reissued, it is not a set of parallel documents.
  job_id                  uuid not null unique references public.jobs(id) on delete cascade,

  document_no             text,
  revision                text not null default 'A',

  -- "Project information" block on every page of the template.
  project_number          text,
  project_name            text,
  customer                text,
  customer_project_number text,

  -- "Product information" block.
  product                 text,
  tag_number              text,
  product_type            text,

  -- Letterhead. Defaults come from app_config when the book is created,
  -- but are stored here so a book issued under one letterhead keeps it.
  company_name            text,
  company_address         text,

  notes                   text,
  created_by              uuid references public.users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

comment on table public.job_mdb is
  'Manufacturing Data Book header for a job. One per job; revision is a field, not a row.';

-- ---------------------------------------------------------------------
-- Sections
-- ---------------------------------------------------------------------
create table if not exists public.job_mdb_sections (
  id            uuid primary key default gen_random_uuid(),
  mdb_id        uuid not null references public.job_mdb(id) on delete cascade,
  seq_no        integer not null,

  chapter_no    text not null,   -- '1'
  chapter_title text not null,   -- 'General / Project Information'
  section_no    text not null,   -- '1.1'
  section_title text not null,   -- 'Inspection & Test Plan'
  code          text,            -- 'ITP' -- the tab marker on the divider page

  -- Where the section stands. 'not_applicable' is deliberately kept in the
  -- book rather than deleted: a client reading the index needs to see that
  -- a chapter was considered and ruled out, not silently missing.
  status        text not null default 'pending'
                  check (status in ('included', 'pending', 'not_applicable')),
  doc_reference text,
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists jms_mdb_idx on public.job_mdb_sections (mdb_id, seq_no);

comment on table public.job_mdb_sections is
  'Chapters of a job MDB, seeded from the standard catalogue and editable per job.';

-- ---------------------------------------------------------------------
-- Evidence: documents already uploaded to the Documents module
-- ---------------------------------------------------------------------
create table if not exists public.job_mdb_section_documents (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.job_mdb_sections(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (section_id, document_id)
);

create index if not exists jmsd_section_idx on public.job_mdb_section_documents (section_id);

comment on table public.job_mdb_section_documents is
  'Links a document already in the Documents module to the MDB section it evidences.';

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create trigger t50_set_updated_at before update on public.job_mdb
  for each row execute function public.set_updated_at();

create trigger t50_set_updated_at before update on public.job_mdb_sections
  for each row execute function public.set_updated_at();

create trigger z_audit after insert or delete or update on public.job_mdb
  for each row execute function public.audit_trigger();

create trigger z_audit after insert or delete or update on public.job_mdb_sections
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- RLS -- operational, so every tier reads and writes; admins delete.
-- Section and link rows inherit their book's visibility.
-- ---------------------------------------------------------------------
alter table public.job_mdb                    enable row level security;
alter table public.job_mdb_sections           enable row level security;
alter table public.job_mdb_section_documents  enable row level security;

create policy jmdb_sel on public.job_mdb for select
  using (public.auth_user_tier() >= 1 and (deleted_at is null or public.auth_is_admin()));

create policy jmdb_ins on public.job_mdb for insert
  with check (public.auth_user_tier() >= 1);

create policy jmdb_upd on public.job_mdb for update
  using (public.auth_user_tier() >= 1)
  with check (public.auth_user_tier() >= 1);

create policy jmdb_del on public.job_mdb for delete
  using (public.auth_is_admin());

create policy jms_sel on public.job_mdb_sections for select
  using (exists (select 1 from public.job_mdb m
                  where m.id = mdb_id and m.deleted_at is null));

create policy jms_ins on public.job_mdb_sections for insert
  with check (public.auth_user_tier() >= 1
              and exists (select 1 from public.job_mdb m where m.id = mdb_id));

create policy jms_upd on public.job_mdb_sections for update
  using (public.auth_user_tier() >= 1)
  with check (public.auth_user_tier() >= 1);

create policy jms_del on public.job_mdb_sections for delete
  using (public.auth_user_tier() >= 1);

create policy jmsd_sel on public.job_mdb_section_documents for select
  using (exists (select 1 from public.job_mdb_sections s
                  join public.job_mdb m on m.id = s.mdb_id
                 where s.id = section_id and m.deleted_at is null));

create policy jmsd_ins on public.job_mdb_section_documents for insert
  with check (public.auth_user_tier() >= 1
              and exists (select 1 from public.job_mdb_sections s where s.id = section_id));

create policy jmsd_del on public.job_mdb_section_documents for delete
  using (public.auth_user_tier() >= 1);

revoke all on public.job_mdb                   from anon;
revoke all on public.job_mdb_sections          from anon;
revoke all on public.job_mdb_section_documents from anon;

grant select, insert, update, delete on public.job_mdb                   to authenticated;
grant select, insert, update, delete on public.job_mdb_sections          to authenticated;
grant select, insert, delete         on public.job_mdb_section_documents to authenticated;
