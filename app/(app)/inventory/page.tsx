import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit as canEditTier, canSeeFinancials, isAdmin } from "@/lib/types";
import { cn, formatAED } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { CapNotice } from "@/components/layout/cap-notice";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InventoryManager } from "@/components/inventory/inventory-manager";
import { MovementsTable } from "@/components/inventory/movements-table";
import type { InventoryItemView, InventoryMovement } from "@/lib/types";

export const dynamic = "force-dynamic";

type Tab = "stock" | "movements";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { tab?: Tab };
}) {
  const profile = await getProfile();
  const tab: Tab = searchParams.tab ?? "stock";
  const showMoney = canSeeFinancials(profile.role_tier);
  const canEdit = canEditTier(profile.role_tier);
  const canDelete = isAdmin(profile.role_tier);
  const supabase = createClient();

  const [{ data: itemsRaw }, { data: jobsRaw }] = await Promise.all([
    supabase.from("inventory_items_view").select("*").order("description"),
    supabase
      .from("jobs_view")
      .select("id, job_code")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  const items = (itemsRaw ?? []) as InventoryItemView[];
  const jobOptions = (jobsRaw ?? []).map((j: any) => ({
    value: j.id as string,
    label: j.job_code ?? "",
  }));
  const jobCodes: Record<string, string> = Object.fromEntries(
    (jobsRaw ?? []).map((j: any) => [j.id as string, j.job_code ?? ""]),
  );

  const active = items.filter((i) => i.active);
  const lowCount = active.filter((i) => i.low_stock).length;
  const remnants = active.filter((i) => i.item_type === "remnant").length;
  const totalValue = showMoney
    ? active.reduce((s, i) => s + Number(i.stock_value ?? 0), 0)
    : null;

  let movements: InventoryMovement[] = [];
  let movementCount: number | null = null;
  if (tab === "movements") {
    const { data, count } = await supabase
      .from("inventory_movements")
      .select("*", { count: "exact" })
      .order("moved_on", { ascending: false })
      .limit(1000);
    movements = (data ?? []) as InventoryMovement[];
    movementCount = count;
  }
  const itemNames: Record<string, string> = Object.fromEntries(
    items.map((i) => [i.id ?? "", i.description ?? ""]),
  );

  return (
    <div>
      <PageHeader title="Inventory" description="Stock on hand, remnants and the movement ledger" />

      <div className="flex gap-1 border-b border-border bg-card px-6">
        <TabLink current={tab} value="stock" label="Stock" />
        <TabLink current={tab} value="movements" label="Movements" />
      </div>

      <div className="grid grid-cols-2 gap-3 p-6 pb-0 sm:grid-cols-4">
        <KpiCard label="Stock Items" value={String(active.length)} accent="neutral" />
        <KpiCard
          label="Low Stock"
          value={String(lowCount)}
          accent={lowCount > 0 ? "negative" : "positive"}
        />
        <KpiCard label="Remnants" value={String(remnants)} accent="steel" />
        {showMoney ? (
          <KpiCard label="Stock Value" value={formatAED(totalValue ?? 0)} unit="AED" accent="amber" />
        ) : (
          <div className="flex items-center border border-dashed border-border bg-card px-4 text-xs text-muted-foreground">
            Values restricted for your role.
          </div>
        )}
      </div>

      <div className="space-y-3 p-6">
        {tab === "movements" && (
          <CapNotice
            shown={movements.length}
            total={movementCount}
            hint="Older movements are still on the item they belong to."
          />
        )}
        {tab === "stock" ? (
          <InventoryManager
            rows={items}
            showMoney={showMoney}
            canEdit={canEdit}
            canDelete={canDelete}
            jobOptions={jobOptions}
          />
        ) : (
          <MovementsTable
            rows={movements}
            itemNames={itemNames}
            jobCodes={jobCodes}
            canDelete={canDelete}
          />
        )}
      </div>
    </div>
  );
}

function TabLink({ current, value, label }: { current: Tab; value: Tab; label: string }) {
  const active = current === value;
  return (
    <Link
      href={`/inventory?tab=${value}`}
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
