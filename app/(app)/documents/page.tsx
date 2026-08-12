import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentsTable } from "@/components/documents/documents-table";
import { DocumentsFilters } from "@/components/documents/documents-filters";
import { DocumentsGrouped, type DocGroup } from "@/components/documents/documents-grouped";
import { fmtDate } from "@/lib/date";
import type { DocumentRow } from "@/lib/types";
import { canEdit as canEditTier, isAdmin } from "@/lib/types";

export const dynamic = "force-dynamic";
/* eslint-disable @typescript-eslint/no-explicit-any */

export type DocView = "project" | "job" | "certificate" | "date" | "uploader";
const VIEWS: DocView[] = ["project", "job", "certificate", "date", "uploader"];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { type?: string; job?: string; q?: string; view?: string };
}) {
  const profile = await getProfile();
  const canEdit = canEditTier(profile.role_tier);
  const canDelete = isAdmin(profile.role_tier);
  const view: DocView = VIEWS.includes(searchParams.view as DocView)
    ? (searchParams.view as DocView)
    : "project";
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

  const [{ data: docs }, { data: jobs }, { data: projects }, { data: users }, { data: certs }] =
    await Promise.all([
      query,
      supabase
        .from("jobs_view")
        .select("id, job_code, description, project_id")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("projects_view").select("id, project_code, name").order("project_code"),
      supabase.from("users").select("id, full_name"),
      supabase
        .from("welder_certificates")
        .select("id, name, ho_no, position, certificate_no")
        .is("deleted_at", null)
        .order("name"),
    ]);

  const rows = (docs ?? []) as DocumentRow[];
  const jobRows = (jobs ?? []) as any[];
  const projectRows = (projects ?? []) as any[];

  const jobOptions = jobRows.map((j) => ({ value: j.id as string, label: j.job_code ?? "" }));
  const jobCodes: Record<string, string> = Object.fromEntries(
    jobRows.map((j) => [j.id as string, j.job_code ?? ""]),
  );
  const jobDesc: Record<string, string> = Object.fromEntries(
    jobRows.map((j) => [j.id as string, j.description ?? ""]),
  );
  const uploaderNames: Record<string, string> = Object.fromEntries(
    (users ?? []).map((u) => [u.id, u.full_name]),
  );

  const certRows = (certs ?? []) as any[];
  const groups = buildGroups(view, rows, {
    jobRows,
    projectRows,
    certRows,
    jobCodes,
    jobDesc,
    uploaderNames,
  });

  return (
    <div>
      <PageHeader title="Documents" description={`${rows.length} document(s)`}>
        {canEdit && <DocumentUpload jobOptions={jobOptions} />}
      </PageHeader>

      <DocumentsFilters jobs={jobOptions} />

      <div className="p-6">
        {view === "date" ? (
          // Flat, newest first — the closest thing to "just show me everything".
          <DocumentsGrouped
            groups={groups}
            jobCodes={jobCodes}
            jobOptions={jobOptions}
            uploaderNames={uploaderNames}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : groups.length > 0 ? (
          <DocumentsGrouped
            groups={groups}
            jobCodes={jobCodes}
            jobOptions={jobOptions}
            uploaderNames={uploaderNames}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : (
          <DocumentsTable
            rows={rows}
            jobCodes={jobCodes}
            jobOptions={jobOptions}
            uploaderNames={uploaderNames}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}
      </div>
    </div>
  );
}

function buildGroups(
  view: DocView,
  rows: DocumentRow[],
  ctx: {
    jobRows: any[];
    projectRows: any[];
    certRows: any[];
    jobCodes: Record<string, string>;
    jobDesc: Record<string, string>;
    uploaderNames: Record<string, string>;
  },
): DocGroup[] {
  const { jobRows, projectRows, certRows, jobCodes, jobDesc, uploaderNames } = ctx;

  if (view === "certificate") {
    // Certificate scans are ordinary documents that happen to point at a
    // welder certificate; this groups them by the ticket they belong to.
    const out: DocGroup[] = [];
    for (const c of certRows) {
      const mine = rows.filter((d) => (d as any).welder_certificate_id === c.id);
      if (mine.length === 0) continue;
      out.push({
        key: `c-${c.id}`,
        label: c.name,
        sublabel: [c.ho_no ? `HO ${c.ho_no}` : null, c.position, c.certificate_no]
          .filter(Boolean)
          .join(" · ") || null,
        href: "/qa?tab=certificates",
        docs: mine,
      });
    }
    const rest = rows.filter((d) => !(d as any).welder_certificate_id);
    if (rest.length > 0) {
      out.push({
        key: "not-a-certificate",
        label: "Not a certificate",
        sublabel: "Everything else",
        href: null,
        docs: rest,
      });
    }
    return out;
  }

  if (view === "project") {
    // Project -> Job. A document lives on one row; project_id is kept in step
    // with its job by trigger, so nothing is duplicated between the levels.
    const out: DocGroup[] = [];
    for (const p of projectRows) {
      const inProject = rows.filter((d) => d.project_id === p.id);
      if (inProject.length === 0) continue;
      const jobIds = Array.from(
        new Set(inProject.map((d) => d.job_id).filter((id): id is string => !!id)),
      );
      out.push({
        key: `p-${p.id}`,
        label: `${p.project_code} — ${p.name}`,
        sublabel: null,
        href: `/projects/${p.id}`,
        docs: inProject.filter((d) => !d.job_id),
        children: jobIds.map((jid) => ({
          key: `p-${p.id}-j-${jid}`,
          label: jobCodes[jid] ?? "—",
          sublabel: jobDesc[jid] || null,
          href: `/jobs/${jid}/worksheet`,
          docs: inProject.filter((d) => d.job_id === jid),
        })),
      });
    }

    // Jobs with no project, then anything attached to neither.
    const looseJobIds = Array.from(
      new Set(
        rows
          .filter((d) => !d.project_id && d.job_id)
          .map((d) => d.job_id as string),
      ),
    );
    if (looseJobIds.length > 0) {
      out.push({
        key: "no-project",
        label: "Not in a project",
        sublabel: "Jobs not yet assigned to a project",
        href: null,
        docs: [],
        children: looseJobIds.map((jid) => ({
          key: `np-j-${jid}`,
          label: jobCodes[jid] ?? "—",
          sublabel: jobDesc[jid] || null,
          href: `/jobs/${jid}/worksheet`,
          docs: rows.filter((d) => d.job_id === jid && !d.project_id),
        })),
      });
    }
    const general = rows.filter((d) => !d.job_id && !d.project_id);
    if (general.length > 0) {
      out.push({
        key: "general",
        label: "General",
        sublabel: "Not tied to a job or project",
        href: null,
        docs: general,
      });
    }
    return out;
  }

  if (view === "job") {
    const out: DocGroup[] = [];
    for (const j of jobRows) {
      const inJob = rows.filter((d) => d.job_id === j.id);
      if (inJob.length === 0) continue;
      out.push({
        key: `j-${j.id}`,
        label: j.job_code ?? "—",
        sublabel: j.description ?? null,
        href: `/jobs/${j.id}/worksheet`,
        docs: inJob,
      });
    }
    const general = rows.filter((d) => !d.job_id);
    if (general.length > 0) {
      out.push({
        key: "general",
        label: "General",
        sublabel: "Not tied to a job",
        href: null,
        docs: general,
      });
    }
    return out;
  }

  if (view === "uploader") {
    return groupBy(rows, (d) => d.uploaded_by ?? "unknown").map(([id, docs]) => ({
      key: `u-${id}`,
      label: uploaderNames[id] ?? "Unknown",
      sublabel: null,
      href: null,
      docs,
    }));
  }

  // By date: one group per month, newest first.
  return groupBy(rows, (d) => (d.uploaded_at ?? "").slice(0, 7)).map(([month, docs]) => ({
    key: `d-${month}`,
    label: month ? monthLabel(month) : "Undated",
    sublabel: `${fmtDate(docs[docs.length - 1]?.uploaded_at)} – ${fmtDate(docs[0]?.uploaded_at)}`,
    href: null,
    docs,
  }));
}

/** Preserves the incoming order of both the groups and the rows inside them. */
function groupBy<T>(rows: T[], key: (r: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const bucket = map.get(k);
    if (bucket) bucket.push(r);
    else map.set(k, [r]);
  }
  return Array.from(map.entries());
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
