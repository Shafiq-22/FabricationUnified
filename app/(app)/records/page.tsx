import Link from "next/link";
import { addMonths, parseISO, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireTier } from "@/lib/auth";
import { currentMonthKey, monthLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { DateSelector } from "@/components/records/date-selector";
import { TimesheetGrid } from "@/components/records/timesheet-grid";
import { EquipmentUsageGrid } from "@/components/records/equipment-usage-grid";
import { PersonnelManager, EquipmentManager } from "@/components/records/master-lists";
import type { Personnel, Equipment, TimesheetEntry, EquipmentUsage } from "@/lib/types";

export const dynamic = "force-dynamic";

type Tab = "timesheet" | "equipment" | "manage";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: { tab?: Tab; date?: string; month?: string };
}) {
  const profile = await requireTier(2);
  const tab: Tab = searchParams.tab ?? "timesheet";
  const isAdmin = profile.role_tier >= 3;
  const supabase = createClient();

  const { data: cfgRows } = await supabase
    .from("app_config")
    .select("key, value")
    .in("key", ["timesheet_normal_rate", "timesheet_ot_rate"]);
  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));
  const normalRate = Number(cfg.timesheet_normal_rate ?? 30);
  const otRate = Number(cfg.timesheet_ot_rate ?? 45);

  const body =
    tab === "equipment"
      ? await EquipmentTab(supabase, searchParams)
      : tab === "manage"
        ? await ManageTab(supabase, isAdmin)
        : await TimesheetTab(supabase, searchParams, normalRate, otRate);

  return (
    <div>
      <PageHeader
        title="Personnel & Equipment Record"
        description="Daily timesheets and equipment usage cost tracking"
      />
      <div className="flex gap-1 border-b border-border bg-card px-6">
        <TabLink current={tab} value="timesheet" label="Timesheet" params={searchParams} />
        <TabLink current={tab} value="equipment" label="Equipment Usage" params={searchParams} />
        <TabLink current={tab} value="manage" label="Manage Lists" params={searchParams} />
      </div>
      {body}
    </div>
  );
}

function TabLink({
  current, value, label, params,
}: {
  current: Tab; value: Tab; label: string; params: Record<string, string | undefined>;
}) {
  const active = current === value;
  const sp = new URLSearchParams();
  sp.set("tab", value);
  if (params.month) sp.set("month", params.month);
  if (params.date) sp.set("date", params.date);
  return (
    <Link
      href={`/records?${sp.toString()}`}
      className={cn(
        "border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

async function TimesheetTab(supabase: any, sp: any, normalRate: number, otRate: number) {
  const date = sp.date ?? format(new Date(), "yyyy-MM-dd");
  const [{ data: personnel }, { data: entries }] = await Promise.all([
    supabase.from("personnel").select("*").eq("active", true).order("created_at"),
    supabase.from("timesheet_entries").select("*").eq("entry_date", date),
  ]);
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</span>
        <DateSelector value={date} />
      </div>
      <TimesheetGrid
        date={date}
        personnel={(personnel ?? []) as Personnel[]}
        entries={(entries ?? []) as TimesheetEntry[]}
        editable
        normalRate={normalRate}
        otRate={otRate}
      />
    </div>
  );
}

async function EquipmentTab(supabase: any, sp: any) {
  const month = sp.month ?? currentMonthKey();
  const start = `${month}-01`;
  const end = format(addMonths(parseISO(start), 1), "yyyy-MM-dd");
  const [{ data: equipment }, { data: usage }] = await Promise.all([
    supabase.from("equipment").select("*").eq("active", true).order("created_at"),
    supabase.from("equipment_usage").select("*").gte("usage_date", start).lt("usage_date", end),
  ]);
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Month — {monthLabel(month)}
        </span>
        <MonthSelector value={month} />
      </div>
      <EquipmentUsageGrid
        month={month}
        equipment={(equipment ?? []) as Equipment[]}
        usage={(usage ?? []) as EquipmentUsage[]}
        editable
      />
    </div>
  );
}

async function ManageTab(supabase: any, isAdmin: boolean) {
  const [{ data: personnel }, { data: equipment }] = await Promise.all([
    supabase.from("personnel").select("*").order("created_at"),
    supabase.from("equipment").select("*").order("created_at"),
  ]);
  return (
    <div className="space-y-6 p-6">
      <PersonnelManager rows={(personnel ?? []) as Personnel[]} canDelete={isAdmin} />
      <EquipmentManager rows={(equipment ?? []) as Equipment[]} canDelete={isAdmin} />
    </div>
  );
}
