import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { GraphExplorer } from "@/components/graph/graph-explorer";
import { GraphScopePicker } from "@/components/graph/graph-scope-picker";
import type { GraphData, GraphEdge, GraphNode } from "@/lib/graph";

export const dynamic = "force-dynamic";
/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_PER_KIND = 150;

export default async function GraphPage({
  searchParams,
}: {
  searchParams: { projectId?: string; jobId?: string };
}) {
  await getProfile();
  const supabase = createClient();
  const { projectId, jobId } = searchParams;

  // ---- Load the slice of the model we plot ---------------------------
  let jobsQ = supabase
    .from("jobs_view")
    .select("id, job_code, description, status, site_code, project_id")
    .limit(MAX_PER_KIND);
  if (jobId) jobsQ = jobsQ.eq("id", jobId);
  else if (projectId) jobsQ = jobsQ.eq("project_id", projectId);

  const [{ data: jobs }, { data: projects }, { data: clients }] = await Promise.all([
    jobsQ,
    supabase.from("projects_view").select("id, project_code, name, status, client_id").limit(MAX_PER_KIND),
    supabase.from("clients").select("id, name").limit(MAX_PER_KIND),
  ]);

  const jobRows = (jobs ?? []) as any[];
  const jobIds = jobRows.map((j) => j.id as string);

  // Related records, scoped to the jobs in view.
  const [{ data: docs }, { data: materials }, { data: timesheets }, { data: ncrs }] =
    await Promise.all([
      jobIds.length
        ? supabase.from("documents").select("id, title, original_filename, job_id, doc_type").in("job_id", jobIds).is("deleted_at", null).limit(300)
        : Promise.resolve({ data: [] as any[] }),
      jobIds.length
        ? supabase.from("job_materials").select("id, item_name, job_id, supplier_id").in("job_id", jobIds).is("deleted_at", null).limit(300)
        : Promise.resolve({ data: [] as any[] }),
      jobIds.length
        ? supabase.from("timesheet_entries").select("personnel_id, job_id").in("job_id", jobIds).limit(500)
        : Promise.resolve({ data: [] as any[] }),
      jobIds.length
        ? supabase.from("ncrs").select("id, title, job_id, status").in("job_id", jobIds).is("deleted_at", null).limit(200)
        : Promise.resolve({ data: [] as any[] }),
    ]);

  const [{ data: suppliers }, { data: personnel }] = await Promise.all([
    supabase.from("suppliers").select("id, name").limit(MAX_PER_KIND),
    supabase.from("personnel").select("id, name, trade").limit(MAX_PER_KIND),
  ]);

  // ---- Assemble nodes & edges ----------------------------------------
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const add = (n: GraphNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  };

  const usedProjectIds = new Set(jobRows.map((j) => j.project_id).filter(Boolean));
  const projectRows = (projects ?? []).filter(
    (p: any) => !projectId || p.id === projectId || usedProjectIds.has(p.id),
  );
  const usedClientIds = new Set(projectRows.map((p: any) => p.client_id).filter(Boolean));

  (clients ?? [])
    .filter((c: any) => usedClientIds.has(c.id))
    .forEach((c: any) => add({ id: `client:${c.id}`, label: c.name, type: "client", href: "/clients" }));

  projectRows.forEach((p: any) => {
    add({
      id: `project:${p.id}`,
      label: p.project_code ?? p.name,
      type: "project",
      detail: `${p.name}${p.status ? ` · ${p.status}` : ""}`,
      href: "/projects",
    });
    if (p.client_id && seen.has(`client:${p.client_id}`)) {
      edges.push({ source: `client:${p.client_id}`, target: `project:${p.id}` });
    }
  });

  jobRows.forEach((j) => {
    add({
      id: `job:${j.id}`,
      label: j.job_code ?? "Job",
      type: "job",
      detail: `${j.description ?? ""}${j.status ? ` · ${j.status}` : ""}`,
      href: `/jobs/${j.id}/worksheet`,
    });
    if (j.project_id && seen.has(`project:${j.project_id}`)) {
      edges.push({ source: `project:${j.project_id}`, target: `job:${j.id}` });
    }
  });

  (docs ?? []).forEach((d: any) => {
    add({
      id: `document:${d.id}`,
      label: d.title ?? d.original_filename ?? "Document",
      type: "document",
      detail: d.doc_type,
      href: "/documents",
    });
    if (d.job_id) edges.push({ source: `job:${d.job_id}`, target: `document:${d.id}` });
  });

  const supplierById = new Map((suppliers ?? []).map((s: any) => [s.id, s.name]));
  (materials ?? []).forEach((m: any) => {
    add({
      id: `material:${m.id}`,
      label: m.item_name ?? "Material",
      type: "material",
      href: "/procurement",
    });
    if (m.job_id) edges.push({ source: `job:${m.job_id}`, target: `material:${m.id}` });
    if (m.supplier_id && supplierById.has(m.supplier_id)) {
      add({
        id: `supplier:${m.supplier_id}`,
        label: supplierById.get(m.supplier_id) as string,
        type: "supplier",
        href: "/procurement?tab=suppliers",
      });
      edges.push({ source: `material:${m.id}`, target: `supplier:${m.supplier_id}` });
    }
  });

  const personById = new Map((personnel ?? []).map((p: any) => [p.id, p]));
  const seenPersonJob = new Set<string>();
  (timesheets ?? []).forEach((t: any) => {
    if (!t.personnel_id || !t.job_id) return;
    const key = `${t.personnel_id}|${t.job_id}`;
    if (seenPersonJob.has(key)) return; // one edge per person per job
    seenPersonJob.add(key);
    const p = personById.get(t.personnel_id) as any;
    if (!p) return;
    add({
      id: `personnel:${p.id}`,
      label: p.name,
      type: "personnel",
      detail: p.trade ?? undefined,
      href: "/records?tab=manage",
    });
    edges.push({ source: `personnel:${p.id}`, target: `job:${t.job_id}` });
  });

  (ncrs ?? []).forEach((n: any) => {
    add({
      id: `ncr:${n.id}`,
      label: n.title,
      type: "ncr",
      detail: n.status,
      href: "/qa?tab=ncrs",
    });
    if (n.job_id) edges.push({ source: `job:${n.job_id}`, target: `ncr:${n.id}` });
  });

  const data: GraphData = {
    nodes,
    edges: edges.filter((e) => seen.has(e.source) && seen.has(e.target)),
  };

  const projectOptions = (projects ?? []).map((p: any) => ({
    value: p.id as string,
    label: `${p.project_code} — ${p.name}`,
  }));
  const jobOptions = jobRows.map((j) => ({ value: j.id as string, label: j.job_code ?? "" }));

  return (
    <div>
      <PageHeader
        title="Relationship Graph"
        description={`${data.nodes.length} node(s), ${data.edges.length} link(s)`}
      >
        <GraphScopePicker
          projects={projectOptions}
          jobs={jobOptions}
          projectId={projectId}
          jobId={jobId}
        />
      </PageHeader>
      <div className="p-6">
        <GraphExplorer data={data} />
      </div>
    </div>
  );
}
