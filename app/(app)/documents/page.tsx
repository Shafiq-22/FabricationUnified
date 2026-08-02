import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentsTable } from "@/components/documents/documents-table";
import { DocumentsFilters } from "@/components/documents/documents-filters";
import type { DocumentRow } from "@/lib/types";

export const dynamic = "force-dynamic";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { type?: string; job?: string; q?: string };
}) {
  const profile = await getProfile();
  const canEdit = profile.role_tier >= 2;
  const canDelete = profile.role_tier >= 3;
  const supabase = createClient();

  let query = supabase
    .from("documents")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(2000);
  if (searchParams.type) query = query.eq("doc_type", searchParams.type);
  if (searchParams.job) query = query.eq("job_id", searchParams.job);
  if (searchParams.q) {
    const term = searchParams.q.replace(/[%,]/g, " ").trim();
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,original_filename.ilike.%${term}%,notes.ilike.%${term}%`,
      );
    }
  }

  const [{ data: docs }, { data: jobs }, { data: users }] = await Promise.all([
    query,
    supabase
      .from("jobs_view")
      .select("id, job_code")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("users").select("id, full_name"),
  ]);

  const rows = (docs ?? []) as DocumentRow[];
  const jobOptions = (jobs ?? []).map((j: any) => ({
    value: j.id as string,
    label: j.job_code ?? "",
  }));
  const jobCodes: Record<string, string> = Object.fromEntries(
    (jobs ?? []).map((j: any) => [j.id as string, j.job_code ?? ""]),
  );
  const uploaderNames: Record<string, string> = Object.fromEntries(
    (users ?? []).map((u) => [u.id, u.full_name]),
  );

  return (
    <div>
      <PageHeader title="Documents" description={`${rows.length} document(s)`}>
        {canEdit && <DocumentUpload jobOptions={jobOptions} />}
      </PageHeader>

      <DocumentsFilters jobs={jobOptions} />

      <div className="p-6">
        <DocumentsTable
          rows={rows}
          jobCodes={jobCodes}
          jobOptions={jobOptions}
          uploaderNames={uploaderNames}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>
    </div>
  );
}
