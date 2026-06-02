import { createClient } from "@/lib/supabase/server";
import { requireTier } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { CsvExportButton } from "@/components/records/csv-export-button";
import { ProcurementFilters } from "@/components/procurement/procurement-filters";
import { ProcurementManager } from "@/components/procurement/procurement-manager";
import type { JobMaterial } from "@/lib/types";

export const dynamic = "force-dynamic";

const CSV_COLS = [
  { key: "request_date", label: "Request Date" },
  { key: "order_date", label: "Order Date" },
  { key: "job_code", label: "Job" },
  { key: "item_name", label: "Item" },
  { key: "unit", label: "Unit" },
  { key: "qty", label: "Qty" },
  { key: "unit_price", label: "Unit Price" },
  { key: "total_price", label: "Total" },
  { key: "pr_no", label: "PR No" },
  { key: "lpo_no", label: "LPO No" },
  { key: "invoice_dn_no", label: "Invoice/DN No" },
  { key: "delivery_date", label: "Delivery Date" },
  { key: "time_to_deliver_days", label: "Lead Days" },
  { key: "supplier", label: "Supplier" },
];

const monthOf = (d: string | null) => (d ?? "").slice(0, 7);

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: { job?: string; supplier?: string; month?: string };
}) {
  const profile = await requireTier(2);
  const supabase = createClient();

  let query = supabase
    .from("job_materials")
    .select("*")
    .order("order_date", { ascending: false, nullsFirst: false })
    .limit(3000);
  if (searchParams.job) query = query.eq("job_id", searchParams.job);
  if (searchParams.supplier) query = query.ilike("supplier", `%${searchParams.supplier}%`);

  const { data } = await query;
  let rows = (data ?? []) as JobMaterial[];
  if (searchParams.month)
    rows = rows.filter((r) => monthOf(r.order_date) === searchParams.month);

  // Jobs for the filter + form selector + code lookup.
  const { data: jobs } = await supabase
    .from("jobs_view")
    .select("id, job_code")
    .order("created_at", { ascending: false })
    .limit(2000);
  const jobOptions = (jobs ?? []).map((j) => ({
    value: j.id as string,
    label: j.job_code ?? "",
  }));
  const jobCodes = Object.fromEntries(
    (jobs ?? []).map((j) => [j.id as string, j.job_code ?? ""]),
  );

  const delivered = rows.filter((r) => r.time_to_deliver_days != null);
  const avgLead =
    delivered.length > 0
      ? (
          delivered.reduce((s, r) => s + (r.time_to_deliver_days ?? 0), 0) /
          delivered.length
        ).toFixed(1)
      : "—";

  const csvRows = rows.map((r) => ({
    ...r,
    job_code: r.job_id ? jobCodes[r.job_id] ?? "" : "",
  }));

  return (
    <div>
      <PageHeader title="Procurement / Job Material" description={`${rows.length} record(s)`}>
        <CsvExportButton
          filename="procurement.csv"
          columns={CSV_COLS}
          rows={csvRows as unknown as Record<string, unknown>[]}
        />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 p-6 pb-0 sm:grid-cols-4">
        <KpiCard label="Records" value={String(rows.length)} accent="neutral" />
        <KpiCard label="Delivered" value={String(delivered.length)} accent="positive" />
        <KpiCard label="Pending" value={String(rows.length - delivered.length)} accent="amber" />
        <KpiCard label="Avg Days to Deliver" value={avgLead} unit="days" accent="steel" />
      </div>

      <div className="px-6 pt-6">
        <ProcurementFilters jobs={jobOptions} />
      </div>

      <div className="p-6 pt-4">
        <ProcurementManager
          rows={rows}
          jobOptions={jobOptions}
          jobCodes={jobCodes}
          editable={profile.role_tier >= 2}
          canDelete={profile.role_tier >= 3}
        />
      </div>
    </div>
  );
}
