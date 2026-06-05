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
import { ConsumablesManager } from "@/components/consumables/consumables-manager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { JobMaterial, Consumable, HistoricPrice } from "@/lib/types";

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
type Tab = "procurement" | "consumables" | "historic";

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: { tab?: Tab; job?: string; supplier?: string; month?: string; q?: string };
}) {
  const profile = await requireTier(2);
  const tab: Tab = searchParams.tab ?? "procurement";
  const supabase = createClient();
  const canDelete = profile.role_tier >= 3;

  const body =
    tab === "consumables"
      ? await ConsumablesSection(supabase, searchParams, true, canDelete)
      : tab === "historic"
        ? await HistoricSection(supabase, searchParams)
        : await ProcurementSection(supabase, searchParams, true, canDelete);

  return (
    <div>
      <PageHeader
        title="Procurement"
        description="Job materials, consumables and historic pricing"
      />
      <div className="flex gap-1 border-b border-border bg-card px-6">
        <TabLink current={tab} value="procurement" label="Job Material" params={searchParams} />
        <TabLink current={tab} value="consumables" label="Consumables" params={searchParams} />
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
async function ProcurementSection(supabase: any, sp: any, editable: boolean, canDelete: boolean) {
  let query = supabase
    .from("job_materials")
    .select("*")
    .order("order_date", { ascending: false, nullsFirst: false })
    .limit(3000);
  if (sp.job) query = query.eq("job_id", sp.job);
  if (sp.supplier) query = query.ilike("supplier", `%${sp.supplier}%`);
  const { data } = await query;
  let rows = (data ?? []) as JobMaterial[];
  if (sp.month) rows = rows.filter((r) => monthOf(r.order_date) === sp.month);

  const { data: jobs } = await supabase
    .from("jobs_view").select("id, job_code").order("created_at", { ascending: false }).limit(2000);
  const jobOptions = (jobs ?? []).map((j: any) => ({ value: j.id as string, label: j.job_code ?? "" }));
  const jobCodes = Object.fromEntries((jobs ?? []).map((j: any) => [j.id as string, j.job_code ?? ""]));

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
      <div className="flex items-center justify-between gap-2 px-6 pt-6">
        <ProcurementFilters jobs={jobOptions} />
        <CsvExportButton filename="procurement.csv" columns={PROC_CSV} rows={csvRows as any} />
      </div>
      <div className="p-6 pt-4">
        <ProcurementManager rows={rows} jobOptions={jobOptions} jobCodes={jobCodes} editable={editable} canDelete={canDelete} />
      </div>
    </div>
  );
}

async function ConsumablesSection(supabase: any, sp: any, editable: boolean, canDelete: boolean) {
  const month = sp.month ?? currentMonthKey();
  const { data } = await supabase
    .from("consumables").select("*").eq("month_year", month).order("order_date", { ascending: false });
  const rows = (data ?? []) as Consumable[];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-6">
        <p className="text-xs text-muted-foreground">Consumables — {monthLabel(month)}</p>
        <div className="flex items-center gap-2">
          <MonthSelector value={month} />
          <CsvExportButton filename={`consumables-${month}.csv`} columns={CONS_CSV} rows={rows as any} />
        </div>
      </div>
      <div className="p-6 pt-4">
        <ConsumablesManager rows={rows} editable={editable} canDelete={canDelete} />
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
              <TableHead className="text-right">Avg Price</TableHead>
              <TableHead className="text-right">Last Price</TableHead>
              <TableHead>Last Order</TableHead>
              <TableHead className="text-right">Orders</TableHead>
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
