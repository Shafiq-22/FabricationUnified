import Link from "next/link";
import { addMonths, parseISO, format, getDaysInMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireTier } from "@/lib/auth";
import { currentMonthKey, monthLabel, fmtDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { dayCost } from "@/lib/equipment";
import { PageHeader } from "@/components/layout/page-header";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { DateSelector } from "@/components/records/date-selector";
import { TimesheetGrid, type JobOption, type SiteOption } from "@/components/records/timesheet-grid";
import { TimesheetMonthly } from "@/components/records/timesheet-monthly";
import { EquipmentUsageGrid } from "@/components/records/equipment-usage-grid";
import { PersonnelManager, EquipmentManager } from "@/components/records/master-lists";
import { MaintenanceManager } from "@/components/records/maintenance-manager";
import { TimesheetPdfButton } from "@/components/pdf/timesheet-pdf-button";
import { EquipmentPdfButton } from "@/components/pdf/equipment-pdf-button";
import type {
  Personnel,
  Equipment,
  TimesheetEntry,
  EquipmentUsage,
  MaintenanceRecord,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type Tab = "timesheet" | "equipment" | "maintenance" | "manage";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: { tab?: Tab; date?: string; month?: string; view?: string };
}) {
  const profile = await requireTier(2);
  const tab: Tab = searchParams.tab ?? "timesheet";
  const isAdmin = profile.role_tier >= 3;
  const supabase = createClient();

  const { data: cfgRows } = await supabase
    .from("app_config")
    .select("key, value")
    .in("key", ["timesheet_normal_rate", "timesheet_ot_rate", "company_name", "department_name"]);
  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));
  const rates = {
    normal: Number(cfg.timesheet_normal_rate ?? 30),
    ot: Number(cfg.timesheet_ot_rate ?? 45),
  };
  const company = cfg.company_name ?? "Six Construct";
  const department = cfg.department_name ?? "BAF — Steel Fabrication";

  const body =
    tab === "equipment"
      ? await EquipmentTab(supabase, searchParams, company, department)
      : tab === "maintenance"
        ? await MaintenanceTab(supabase, profile.role_tier)
        : tab === "manage"
          ? await ManageTab(supabase, isAdmin)
          : await TimesheetTab(supabase, searchParams, rates, company, department);

  return (
    <div>
      <PageHeader
        title="Personnel & Equipment Record"
        description="Daily timesheets and equipment usage cost tracking"
      />
      <div className="flex gap-1 border-b border-border bg-card px-6">
        <TabLink current={tab} value="timesheet" label="Timesheet" params={searchParams} />
        <TabLink current={tab} value="equipment" label="Equipment Usage" params={searchParams} />
        <TabLink current={tab} value="maintenance" label="Maintenance" params={searchParams} />
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
    <Link href={`/records?${sp.toString()}`} className={cn(
      "border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors",
      active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )}>{label}</Link>
  );
}

function ViewToggle({ view, params }: { view: string; params: any }) {
  const link = (v: string, label: string) => {
    const sp = new URLSearchParams();
    sp.set("tab", "timesheet");
    sp.set("view", v);
    if (params.date) sp.set("date", params.date);
    if (params.month) sp.set("month", params.month);
    return (
      <Link href={`/records?${sp.toString()}`} className={cn(
        "rounded-sm px-3 py-1 text-xs font-medium",
        view === v ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      )}>{label}</Link>
    );
  };
  return <div className="flex items-center gap-1">{link("daily", "Daily")}{link("monthly", "Monthly")}</div>;
}

async function TimesheetTab(supabase: any, sp: any, rates: { normal: number; ot: number }, company: string, department: string) {
  const view = sp.view === "monthly" ? "monthly" : "daily";

  const [{ data: jobsRaw }, { data: sitesRaw }] = await Promise.all([
    supabase.from("jobs_view").select("id, job_code, site_code, company_job_code, quotation_ref").order("created_at", { ascending: false }).limit(2000),
    supabase.from("sites").select("code, name").eq("active", true).order("code"),
  ]);
  const jobs: JobOption[] = (jobsRaw ?? []).map((j: any) => ({
    id: j.id, job_code: j.job_code, site_code: j.site_code, ref: j.company_job_code ?? j.quotation_ref ?? null,
  }));
  const jobCodes: Record<string, string> = Object.fromEntries((jobsRaw ?? []).map((j: any) => [j.id, j.job_code]));
  const sites: SiteOption[] = (sitesRaw ?? []).map((s: any) => ({ code: s.code, name: s.name }));

  if (view === "monthly") {
    const month = sp.month ?? currentMonthKey();
    const start = `${month}-01`;
    const end = format(addMonths(parseISO(start), 1), "yyyy-MM-dd");
    const [{ data: personnel }, { data: entries }] = await Promise.all([
      supabase.from("personnel").select("*").eq("active", true).order("created_at"),
      supabase.from("timesheet_entries").select("*").gte("entry_date", start).lt("entry_date", end),
    ]);
    return (
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ViewToggle view={view} params={sp} />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{monthLabel(month)}</span>
            <MonthSelector value={month} />
          </div>
        </div>
        <TimesheetMonthly month={month} personnel={(personnel ?? []) as Personnel[]} entries={(entries ?? []) as TimesheetEntry[]} jobCodes={jobCodes} />
      </div>
    );
  }

  // daily
  const date = sp.date ?? format(new Date(), "yyyy-MM-dd");
  const [{ data: personnel }, { data: entries }] = await Promise.all([
    supabase.from("personnel").select("*").eq("active", true).order("created_at"),
    supabase.from("timesheet_entries").select("*").eq("entry_date", date),
  ]);
  const people = (personnel ?? []) as Personnel[];
  const ents = (entries ?? []) as TimesheetEntry[];
  const byPid = Object.fromEntries(ents.map((e) => [e.personnel_id, e]));

  const pdfRows = people
    .filter((p) => byPid[p.id])
    .map((p) => {
      const e = byPid[p.id];
      const total = (e.normal_hours ?? 0) + (e.ot_hours ?? 0);
      return {
        ho_no: p.ho_no, name: p.name, trade: p.trade,
        begin: e.begin_time, end: e.end_time, normal: e.normal_hours, ot: e.ot_hours, total,
        site: e.site, job_name: e.job_id ? jobCodes[e.job_id] ?? null : null,
        job_description: e.job_description, job_ref: e.job_ref,
      };
    });
  const totalHrs = pdfRows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewToggle view={view} params={sp} />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</span>
          <DateSelector value={date} />
          <TimesheetPdfButton
            data={{ companyName: company, department, dateLabel: fmtDate(date), rows: pdfRows, totalHrs }}
            filename={`timesheet-${date}.pdf`}
          />
        </div>
      </div>
      <TimesheetGrid
        date={date}
        personnel={people}
        entries={ents}
        editable
        normalRate={rates.normal}
        otRate={rates.ot}
        jobs={jobs}
        sites={sites}
      />
    </div>
  );
}

async function EquipmentTab(supabase: any, sp: any, company: string, department: string) {
  const month = sp.month ?? currentMonthKey();
  const start = `${month}-01`;
  const end = format(addMonths(parseISO(start), 1), "yyyy-MM-dd");
  const [{ data: equipment }, { data: usage }] = await Promise.all([
    supabase.from("equipment").select("*").eq("active", true).order("created_at"),
    supabase.from("equipment_usage").select("*").gte("usage_date", start).lt("usage_date", end),
  ]);
  const equip = (equipment ?? []) as Equipment[];
  const use = (usage ?? []) as EquipmentUsage[];

  // PDF rows: codes per day + monthly cost per equipment
  const byEquip: Record<string, Record<number, string>> = {};
  for (const u of use) {
    const day = Number(u.usage_date.slice(8, 10));
    (byEquip[u.equipment_id] ??= {})[day] = u.status_code;
  }
  const days = getDaysInMonth(parseISO(start));
  const pdfRows = equip.map((e) => {
    const codes = byEquip[e.id] ?? {};
    const cost = Object.values(codes).reduce((s, code) => s + dayCost(code, e.bare_rate, e.driver_rate), 0);
    return { sixco_no: e.sixco_no, device_group: e.device_group, machine: e.machine, make: e.make, type: e.type, codes, cost };
  });
  const total = pdfRows.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Month — {monthLabel(month)}</span>
          <MonthSelector value={month} />
        </div>
        <EquipmentPdfButton
          data={{ companyName: company, department, monthLabel: monthLabel(month), days, rows: pdfRows, total }}
          filename={`equipment-record-${month}.pdf`}
        />
      </div>
      <EquipmentUsageGrid month={month} equipment={equip} usage={use} editable />
    </div>
  );
}

async function MaintenanceTab(supabase: any, tier: number) {
  const [{ data: records }, { data: equipment }, { data: personnel }] = await Promise.all([
    supabase.from("maintenance_records").select("*").order("performed_on", { ascending: false }).limit(1000),
    supabase.from("equipment").select("*").order("created_at"),
    supabase.from("personnel").select("id, name").eq("active", true).order("name"),
  ]);
  const personnelOptions = (personnel ?? []).map((p: any) => ({
    value: p.id as string,
    label: p.name as string,
  }));
  const personnelNames: Record<string, string> = Object.fromEntries(
    (personnel ?? []).map((p: any) => [p.id as string, p.name as string]),
  );
  return (
    <div className="p-6">
      <MaintenanceManager
        rows={(records ?? []) as MaintenanceRecord[]}
        equipment={(equipment ?? []) as Equipment[]}
        personnelOptions={personnelOptions}
        personnelNames={personnelNames}
        showMoney={tier >= 2}
        canEdit={tier >= 2}
        canDelete={tier >= 3}
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
