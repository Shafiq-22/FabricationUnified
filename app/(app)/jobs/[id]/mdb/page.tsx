import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit, isAdmin } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  MdbBuilder,
  type JobDocumentOption,
  type MdbHeader,
  type MdbSection,
} from "@/components/mdb/mdb-builder";
import { CreateMdbPanel } from "@/components/mdb/create-mdb-panel";

export const dynamic = "force-dynamic";

/**
 * The Manufacturing Data Book for a job — the dossier handed over on
 * completion. Sits alongside the worksheet and rough sheet rather than inside
 * the worksheet tabs, because it is a quality record: every tier can compile
 * it, including tier 2, which cannot see the worksheet at all.
 */
export default async function MdbPage({ params }: { params: { id: string } }) {
  const profile = await getProfile();
  const editable = canEdit(profile.role_tier);
  const supabase = createClient();

  const { data: job } = await supabase
    .from("jobs_view")
    .select("id, job_code, description")
    .eq("id", params.id)
    .maybeSingle();
  if (!job) notFound();

  const { data: mdb } = await supabase
    .from("job_mdb")
    .select("*")
    .eq("job_id", params.id)
    .is("deleted_at", null)
    .maybeSingle();

  const header = (
    <PageHeader
      title={`MDB — ${job.job_code ?? "Job"}`}
      description={job.description ?? undefined}
    >
      <Button asChild variant="ghost" size="sm">
        <Link href={`/jobs/${params.id}/worksheet`}>
          <ArrowLeft className="h-4 w-4" /> Worksheet
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/documents?job=${params.id}`}>
          <BookText className="h-4 w-4" /> Documents
        </Link>
      </Button>
    </PageHeader>
  );

  if (!mdb) {
    return (
      <div>
        {header}
        <CreateMdbPanel jobId={params.id} editable={editable} />
      </div>
    );
  }

  // Sections plus the documents linked to each. The link table is read
  // separately and stitched here rather than through a nested select, so the
  // shape stays explicit and one missing document cannot drop a section.
  const [{ data: sectionRows }, { data: docRows }] = await Promise.all([
    supabase
      .from("job_mdb_sections")
      .select("*")
      .eq("mdb_id", mdb.id)
      .order("chapter_no")
      .order("seq_no"),
    supabase
      .from("documents")
      .select("id, title, original_filename, doc_type, revision")
      .eq("job_id", params.id)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false }),
  ]);

  const sections = sectionRows ?? [];
  const { data: linkRows } = await supabase
    .from("job_mdb_section_documents")
    .select("section_id, document_id")
    .in(
      "section_id",
      sections.length > 0 ? sections.map((s) => s.id) : ["00000000-0000-0000-0000-000000000000"],
    );

  const jobDocuments: JobDocumentOption[] = (docRows ?? []).map((d) => ({
    id: d.id,
    title: d.title ?? d.original_filename ?? "Untitled document",
    doc_type: d.doc_type,
    revision: d.revision,
  }));
  const docById = new Map(jobDocuments.map((d) => [d.id, d]));

  const linksBySection = new Map<string, JobDocumentOption[]>();
  for (const l of linkRows ?? []) {
    const doc = docById.get(l.document_id);
    if (!doc) continue; // deleted or filed against another job
    const list = linksBySection.get(l.section_id);
    if (list) list.push(doc);
    else linksBySection.set(l.section_id, [doc]);
  }

  // Chapters are numbered as text, so "10" sorts before "2" — order them
  // numerically here rather than relying on the database collation.
  const ordered: MdbSection[] = sections
    .map((s) => ({
      id: s.id,
      seq_no: s.seq_no,
      chapter_no: s.chapter_no,
      chapter_title: s.chapter_title,
      section_no: s.section_no,
      section_title: s.section_title,
      code: s.code,
      status: s.status,
      doc_reference: s.doc_reference,
      notes: s.notes,
      documents: linksBySection.get(s.id) ?? [],
    }))
    .sort(
      (a, b) =>
        Number(a.chapter_no) - Number(b.chapter_no) || a.seq_no - b.seq_no,
    );

  return (
    <div className="pb-10">
      {header}
      <MdbBuilder
        jobId={params.id}
        jobCode={job.job_code ?? ""}
        header={mdb as MdbHeader}
        sections={ordered}
        jobDocuments={jobDocuments}
        editable={editable}
        isAdmin={isAdmin(profile.role_tier)}
      />
    </div>
  );
}
