import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTier } from "@/lib/auth";
import { currentMonthKey, monthLabel, fmtDate } from "@/lib/date";
import { formatAED, cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { CsvExportButton } from "@/components/records/csv-export-button";
import { ProcurementFilters } from "@/components/procurement/procurement-filters";
import { ProcurementManager } from "@/components/procurement/procurement-manager";
import {
  ProcurementGrouped,
  type ProjectBucket,
} from "@/components/procurement/procurement-grouped";
import { ConsumablesManager } from "@/components/consumables/consumables-manager";
import { SuppliersManager } from "@/components/procurement/suppliers-manager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { JobMaterial, Consumable, HistoricPrice, Supplier } from "@/lib/types";
import { isAdmin } from "@/lib/types";

export const dynamic = "force-dynamic";

const PROC_CSV = [
  { key: "request_date", label: "Request Date" }, { key: "order_date", label: "Order Date" },
  { key: "job_code", label: "Job" }, { key: "item_name", label: "Item" }, { key: "unit", label: "Unit" },
  { key: "qty", label: "Qty" }, { key: "unit_price", label: "Unit Price" }, { key: "total_price", label: "Total" },
  { key: "pr_no", label: "PR No" }, { key: "lpo_no", label: "LPO No" }, { key: "invoice_dn_no", label: "Invoice/DN" },
  { key: "delivery_date", label: "Delivery Date" }, { key: "time_to_deliver_days", label: "Lead Days" }, { key: "supplier", label: "Supplier" },
];
const CONS_CSV = [
  { key: "order_date", label: "Order Date" }, { key: "item_name", label: "Item" }, { key: "unit", label: "Unit" },
  { key: "qty", label: "Qty" }, { key: "unit_price", label: "Unit Price" }, { key: "total_price", label: "Total" },
  { key: "pr_no", label: "PR No" }, { key: "lpo_no", label: "LPO No" }, { key: "invoice_dn_no", label: "Invoice/DN" },
  { key: "delivery_date", label: "Delivery Date" }, { key: "supplier", label: "Supplier" },
];

const monthOf = (d: string | null) => (d ?? "").slice(0, 7);
type Tab = "procurement" | "consumables" | "suppliers" | "historic";

/** Active suppliers as dialog `select` options, plus per-supplier usage counts. */
async function loadSuppliers(supabase: any) {
  const [{ data: sup }, { data: jm }, { data: cons }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("job_materials").select("supplier_id").is("deleted_at", null).not("supplier_id", "is", null),
    supabase.from("consumables").select("supplier_id").is("deleted_at", null).not("supplier_id", "is", null),
  ]);
  const rows = (sup ?? []) as Supplier[];
  const usageCounts: Record<string, number> = {};
  [...(jm ?? []), ...(cons ?? [])].forEach((r: any) => {
    if (r.supplier_id) usageCounts[r.supplier_id] = (usageCounts[r.supplier_id] ?? 0) + 1;
  });
  const options = rows
    .filter((s) => s.active)
    .map((s) => ({ value: s.id, label: s.name }));
  return { rows, options, usageCounts };
}

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: {
    tab?: Tab; job?: string; supplier?: string; month?: string; q?: string; group?: string;
  };
}) {
  const profile = await requireTier(2);
  const tab: Tab = searchParams.tab ?? "procurement";
  const supabase = createClient();
  const canDelete = isAdmin(profile.role_tier);

  const suppliers = await loadSuppliers(supabase);

  const body =
    tab === "consumables"
      ? await ConsumablesSection(supabase, searchParams, true, canDelete, suppliers.options, suppliers.rows, profile.full_name)
      : tab === "suppliers"
        ? SuppliersSection(suppliers, canDelete)
        : tab === "historic"
          ? await HistoricSection(supabase, searchParams)
          : await ProcurementSection(supabase, searchParams, true, canDelete, suppliers.options, suppliers.rows, profile.full_name);

  return (
    <div>
      <PageHeader
        title="Procurement"
        description="Job materials, consumables and historic pricing"
      />
      <div className="flex gap-1 border-b border-border bg-card px-6">
        <TabLink current={tab} value="procurement" label="Job Material" params={searchParams} />
        <TabLink current={tab} value="consumables" label="Consumables" params={searchParams} />
        <TabLink current={tab} value="suppliers" label="Suppliers" params={searchParams} />
        <TabLink current={tab} value="historic" label="Historic Prices" params={searchParams} />
      </div>
      {body}
    </div>
  );
}

function TabLink({
  current,
  value,
  label,
  params,
}: {
  current: Tab;
  value: Tab;
  label: string;
  params: Record<string, string | undefined>;
}) {
  const active = current === value;
  const sp = new URLSearchParams();
  sp.set("tab", value);
  // carry month across tabs for convenience
  if (params.month) sp.set("month", params.month);
  return (
    <Link
      href={`/procurement?${sp.toString()}`}
      className={cn(
        "border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function SuppliersSection(
  suppliers: { rows: Supplier[]; usageCounts: Record<string, number> },
  canDelete: boolean,
) {
  return (
    <div className="p-6">
      <SuppliersManager
        rows={suppliers.rows}
        canDelete={canDelete}
        usageCounts={suppliers.usageCounts}
      />
    </div>
  );
}

async function ProcurementSection(
  supabase: any,
  sp: any,
  editable: boolean,
  canDelete: boolean,
  supplierOptions: { value: string; label: string }[],
  supplierRows: Supplier[],
  senderName: string,
) {
  // Grouped by default: procurement is chased per job, and a job belongs to a
  // project. Flat is still there for editing and bulk work.
  const grouped = (sp.group ?? "project") !== "flat";
  let query = supabase
    .from("job_materials")
    .select("*")
    .is("deleted_at", null)
    .order("order_date", { ascending: false, nullsFirst: false })
    .limit(3000);
  if (sp.job) query = query.eq("job_id", sp.job);
  if (sp.supplier) query = query.ilike("supplier", `%${sp.supplier}%`);
  const { data } = await query;
  let rows = (data ?? []) as JobMaterial[];
  if (sp.month) rows = rows.filter((r) => monthOf(r.order_date) === sp.month);

  const [{ data: jobs }, { data: projects }, { data: cfgRows }] = await Promise.all([
    supabase
      .from("jobs_view")
      .select("id, job_code, description, site_code, project_id")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("projects_view").select("id, project_code, name").order("project_code"),
    supabase.from("app_config").select("key, value"),
  ]);
  const jobOptions = (jobs ?? []).map((j: any) => ({ value: j.id as string, label: j.job_code ?? "" }));
  const jobCodes = Object.fromEntries((jobs ?? []).map((j: any) => [j.id as string, j.job_code ?? ""]));
  const cfg = Object.fromEntries((cfgRows ?? []).map((r: any) => [r.key, r.value]));

  const buckets = grouped ? buildBuckets(rows, jobs ?? [], projects ?? []) : [];
  const supplierEmails: Record<string, string> = Object.fromEntries(
    supplierRows.filter((s) => s.contact_email).map((s) => [s.id, s.contact_email as string]),
  );

  const delivered = rows.filter((r) => r.time_to_deliver_days != null);
  const avgLead = delivered.length
    ? (delivered.reduce((s, r) => s + (r.time_to_deliver_days ?? 0), 0) / delivered.length).toFixed(1)
    : "—";
  const csvRows = rows.map((r) => ({ ...r, job_code: r.job_id ? jobCodes[r.job_id] ?? "" : "" }));

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 p-6 pb-0 sm:grid-cols-4">
        <KpiCard label="Records" value={String(rows.length)} accent="neutral" />
        <KpiCard label="Delivered" value={String(delivered.length)} accent="positive" />
        <KpiCard label="Pending" value={String(rows.length - delivered.length)} accent="amber" />
        <KpiCard label="Avg Days to Deliver" value={avgLead} unit="days" accent="steel" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-6">
        <ProcurementFilters jobs={jobOptions} />
        <div className="flex items-center gap-2">
          <GroupToggle grouped={grouped} params={sp} />
          <CsvExportButton filename="procurement.csv" columns={PROC_CSV} rows={csvRows as any} />
        </div>
      </div>
      <div className="p-6 pt-4">
        {grouped ? (
          <ProcurementGrouped
            buckets={buckets}
            supplierEmails={supplierEmails}
            senderName={senderName}
            companyName={cfg.company_name ?? "Six Construct"}
            departmentName={cfg.department_name ?? "Steel Fabrication"}
            canDelete={canDelete}
            kind="material"
          />
        ) : (
          <ProcurementManager rows={rows} jobOptions={jobOptions} jobCodes={jobCodes} editable={editable} canDelete={canDelete} supplierOptions={supplierOptions} />
        )}
      </div>
    </div>
  );
}

async function ConsumablesSection(
  supabase: any,
  sp: any,
  editable: boolean,
  canDelete: boolean,
  supplierOptions: { value: string; label: string }[],
  supplierRows: Supplier[],
  senderName: string,
) {
  const month = sp.month ?? currentMonthKey();
  const grouped = (sp.group ?? "project") !== "flat";

  const [{ data }, { data: jobs }, { data: projects }, { data: cfgRows }] = await Promise.all([
    supabase
      .from("consumables")
      .select("*")
      .is("deleted_at", null)
      .eq("month_year", month)
      .order("order_date", { ascending: false }),
    supabase
      .from("jobs_view")
      .select("id, job_code, description, site_code, project_id")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("projects_view").select("id, project_code, name").order("project_code"),
    supabase.from("app_config").select("key, value"),
  ]);
  const rows = (data ?? []) as Consumable[];
  const cfg = Object.fromEntries((cfgRows ?? []).map((r: any) => [r.key, r.value]));
  const jobOptions = (jobs ?? []).map((j: any) => ({ value: j.id as string, label: j.job_code ?? "" }));
  const buckets = grouped ? buildBuckets(rows as any, jobs ?? [], projects ?? []) : [];
  const supplierEmails: Record<string, string> = Object.fromEntries(
    supplierRows.filter((s) => s.contact_email).map((s) => [s.id, s.contact_email as string]),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-6">
        <p className="text-xs text-muted-foreground">Consumables — {monthLabel(month)}</p>
        <div className="flex items-center gap-2">
          <MonthSelector value={month} />
          <GroupToggle grouped={grouped} params={sp} tab="consumables" />
          <CsvExportButton filename={`consumables-${month}.csv`} columns={CONS_CSV} rows={rows as any} />
        </div>
      </div>
      <div className="p-6 pt-4">
        {grouped ? (
          <ProcurementGrouped
            buckets={buckets}
            supplierEmails={supplierEmails}
            senderName={senderName}
            companyName={cfg.company_name ?? "Six Construct"}
            departmentName={cfg.department_name ?? "Steel Fabrication"}
            emptyLabel="No consumables recorded this month."
            canDelete={canDelete}
            kind="consumable"
          />
        ) : (
          <ConsumablesManager
            rows={rows}
            editable={editable}
            canDelete={canDelete}
            supplierOptions={supplierOptions}
            jobOptions={jobOptions}
          />
        )}
      </div>
    </div>
  );
}

async function HistoricSection(supabase: any, sp: any) {
  let query = supabase.from("historic_prices").select("*").order("item_name").limit(2000);
  if (sp.q) query = query.ilike("item_name", `%${String(sp.q).replace(/[%,]/g, " ").trim()}%`);
  const { data } = await query;
  const rows = (data ?? []) as HistoricPrice[];
  return (
    <div className="p-6">
      <div className="border border-border bg-card">
        <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          Recorded procurement prices by item &amp; supplier ({rows.length})
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Avg Price</TableHead>
              <TableHead>Last Price</TableHead>
              <TableHead>Last Order</TableHead>
              <TableHead>Orders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No procurement history yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{r.item_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.supplier ?? "—"}</TableCell>
                <TableCell className="text-right tabular text-xs font-medium">{formatAED(r.avg_price)}</TableCell>
                <TableCell className="text-right tabular text-xs">{formatAED(r.last_price)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(r.last_date)}</TableCell>
                <TableCell className="text-right tabular text-xs">{r.order_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * Project -> Job -> material lines. Jobs that are not in a project, and lines
 * with no job at all, get their own buckets rather than being dropped.
 */
function buildBuckets(
  rows: JobMaterial[],
  jobs: any[],
  projects: any[],
): ProjectBucket[] {
  const jobById = new Map(jobs.map((j) => [j.id as string, j]));
  const projectById = new Map(projects.map((p) => [p.id as string, p]));

  // job id (or "" for unassigned lines) -> its lines, order preserved.
  const byJob = new Map<string, JobMaterial[]>();
  for (const r of rows) {
    const key = r.job_id ?? "";
    const bucket = byJob.get(key);
    if (bucket) bucket.push(r);
    else byJob.set(key, [r]);
  }

  const byProject = new Map<string, ProjectBucket>();
  const bucketFor = (projectId: string | null): ProjectBucket => {
    const key = projectId ?? "__none__";
    let b = byProject.get(key);
    if (!b) {
      const p = projectId ? projectById.get(projectId) : null;
      b = {
        projectId: p ? (p.id as string) : null,
        projectCode: p ? (p.project_code as string) : "Not in a project",
        projectName: p ? (p.name as string) : null,
        jobs: [],
      };
      byProject.set(key, b);
    }
    return b;
  };

  for (const [jobId, lines] of Array.from(byJob.entries())) {
    const job = jobId ? jobById.get(jobId) : null;
    bucketFor(job?.project_id ?? null).jobs.push({
      jobId: jobId || null,
      jobCode: job?.job_code ?? "No job",
      jobDescription: job?.description ?? null,
      siteCode: job?.site_code ?? null,
      rows: lines,
    });
  }

  // Real projects first, the catch-all last.
  return Array.from(byProject.values()).sort((a, b) =>
    a.projectId === b.projectId ? 0 : a.projectId ? -1 : 1,
  );
}

function GroupToggle({
  grouped,
  params,
  tab = "procurement",
}: {
  grouped: boolean;
  params: Record<string, string | undefined>;
  tab?: string;
}) {
  const href = (group: string) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v && k !== "group") sp.set(k, v);
    });
    sp.set("tab", tab);
    sp.set("group", group);
    return `/procurement?${sp.toString()}`;
  };
  return (
    <div className="flex items-center gap-1">
      <Link
        href={href("project")}
        className={cn(
          "border px-2 py-1 text-xs transition-colors",
          grouped
            ? "border-primary bg-primary/10 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        By Project
      </Link>
      <Link
        href={href("flat")}
        className={cn(
          "border px-2 py-1 text-xs transition-colors",
          !grouped
            ? "border-primary bg-primary/10 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        All Lines
      </Link>
    </div>
  );
}
