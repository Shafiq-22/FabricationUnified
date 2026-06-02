import { createClient } from "@/lib/supabase/server";
import { requireTier } from "@/lib/auth";
import { currentMonthKey, monthLabel } from "@/lib/date";
import { PageHeader } from "@/components/layout/page-header";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { CsvExportButton } from "@/components/records/csv-export-button";
import { ConsumablesManager } from "@/components/consumables/consumables-manager";
import type { Consumable } from "@/lib/types";

export const dynamic = "force-dynamic";

const CSV_COLS = [
  { key: "order_date", label: "Order Date" },
  { key: "item_name", label: "Item" },
  { key: "unit", label: "Unit" },
  { key: "qty", label: "Qty" },
  { key: "unit_price", label: "Unit Price" },
  { key: "total_price", label: "Total" },
  { key: "pr_no", label: "PR No" },
  { key: "lpo_no", label: "LPO No" },
  { key: "invoice_dn_no", label: "Invoice/DN No" },
  { key: "delivery_date", label: "Delivery Date" },
  { key: "supplier", label: "Supplier" },
];

export default async function ConsumablesPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const profile = await requireTier(2);
  const month = searchParams.month ?? currentMonthKey();
  const supabase = createClient();

  const { data } = await supabase
    .from("consumables")
    .select("*")
    .eq("month_year", month)
    .order("order_date", { ascending: false });
  const rows = (data ?? []) as Consumable[];

  return (
    <div>
      <PageHeader
        title="Consumables"
        description={`Workshop consumables — ${monthLabel(month)}`}
      >
        <MonthSelector value={month} />
        <CsvExportButton
          filename={`consumables-${month}.csv`}
          columns={CSV_COLS}
          rows={rows as unknown as Record<string, unknown>[]}
        />
      </PageHeader>
      <div className="p-6">
        <ConsumablesManager
          rows={rows}
          editable={profile.role_tier >= 2}
          canDelete={profile.role_tier >= 3}
        />
      </div>
    </div>
  );
}
