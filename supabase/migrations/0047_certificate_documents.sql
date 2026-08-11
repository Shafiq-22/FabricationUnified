-- =====================================================================
-- 0047: Welder certificates carry their scanned ticket.
--
-- The file lives where every other file lives: one row in documents,
-- linked rather than copied. The Documents tab lists it because it lists
-- documents; the certificate row shows it because it points at it. There
-- is no second copy to keep in step, which is the same arrangement used
-- for a document's job and project.
--
-- Deleting a certificate sets the link to null rather than cascading, so
-- the scan survives in Documents.
--
-- 'requisition' was added to the app's type list in the previous round but
-- never to this check constraint, so choosing it failed on insert.
-- =====================================================================

alter table public.documents
  add column welder_certificate_id uuid
    references public.welder_certificates(id) on delete set null;
create index documents_cert_idx on public.documents(welder_certificate_id);

alter table public.documents drop constraint documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type = any (array[
    'drawing','requisition','certificate','invoice','po',
    'inspection_report','photo','email','other'
  ]));
