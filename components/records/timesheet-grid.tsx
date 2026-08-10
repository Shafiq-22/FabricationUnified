"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { saveTimesheet, type TimesheetRow } from "@/app/(app)/records/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED } from "@/lib/utils";
import type { Personnel, TimesheetEntry } from "@/lib/types";

export interface JobOption {
  id: string;
  job_code: string;
  site_code: string | null;
  ref: string | null;
}
export interface SiteOption {
  code: string;
  name: string;
}

type Cell = {
  job_id: string;
  site: string;
  begin_time: string;
  end_time: string;
  normal_hours: string;
  ot_hours: string;
  job_description: string;
  job_ref: string;
};
const blank = (): Cell => ({
  job_id: "", site: "", begin_time: "", end_time: "",
  normal_hours: "", ot_hours: "", job_description: "", job_ref: "",
});

const cellCss =
  "h-7 w-full border border-transparent bg-transparent px-1 outline-none focus:border-input focus:bg-background";

export function TimesheetGrid({
  date, personnel, entries, editable, normalRate, otRate, rateByTrade, jobs, sites,
}: {
  date: string;
  personnel: Personnel[];
  entries: TimesheetEntry[];
  editable: boolean;
  normalRate: number;
  otRate: number;
  /** Per-designation rates from Settings > Labour Rates, keyed lowercase. */
  rateByTrade?: Record<string, { normal: number; ot: number }>;
  jobs: JobOption[];
  sites: SiteOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [data, setData] = useState<Record<string, Cell>>(() => {
    const byId: Record<string, Cell> = {};
    for (const p of personnel) byId[p.id] = blank();
    for (const e of entries) {
      byId[e.personnel_id] = {
        job_id: e.job_id ?? "", site: e.site ?? "",
        begin_time: e.begin_time ?? "", end_time: e.end_time ?? "",
        normal_hours: e.normal_hours == null ? "" : String(e.normal_hours),
        ot_hours: e.ot_hours == null ? "" : String(e.ot_hours),
        job_description: e.job_description ?? "", job_ref: e.job_ref ?? "",
      };
    }
    return byId;
  });

  const set = (pid: string, key: keyof Cell, v: string) => {
    setData((d) => ({ ...d, [pid]: { ...d[pid], [key]: v } }));
    setDirty(true);
  };

  // Selecting a job autofills Site and Job Ref (when empty or still matching the previous job).
  const onJob = (pid: string, jobId: string) => {
    setData((d) => {
      const row = d[pid] ?? blank();
      const job = jobs.find((j) => j.id === jobId);
      const prev = jobs.find((j) => j.id === row.job_id);
      const next: Cell = { ...row, job_id: jobId };
      if (job) {
        if (!row.site || row.site === (prev?.site_code ?? "")) next.site = job.site_code ?? "";
        if (!row.job_ref || row.job_ref === (prev?.ref ?? "")) next.job_ref = job.ref ?? "";
      }
      return { ...d, [pid]: next };
    });
    setDirty(true);
  };

  // A person is costed at their trade's rate; the Settings figures are the
  // fallback for a trade with no rate of its own.
  const ratesFor = (personnelId: string) => {
    const trade = personnel.find((p) => p.id === personnelId)?.trade ?? "";
    const r = rateByTrade?.[trade.trim().toLowerCase()];
    return { normal: r?.normal ?? normalRate, ot: r?.ot ?? otRate };
  };
  const cost = (personnelId: string, c: Cell) => {
    const r = ratesFor(personnelId);
    return Number(c.normal_hours || 0) * r.normal + Number(c.ot_hours || 0) * r.ot;
  };
  const totalNor = personnel.reduce((s, p) => s + Number(data[p.id]?.normal_hours || 0), 0);
  const totalOt = personnel.reduce((s, p) => s + Number(data[p.id]?.ot_hours || 0), 0);
  const totalCost = personnel.reduce((s, p) => s + cost(p.id, data[p.id] ?? blank()), 0);

  const save = () =>
    start(async () => {
      const rows: TimesheetRow[] = personnel.map((p) => {
        const c = data[p.id] ?? blank();
        return {
          personnel_id: p.id,
          job_id: c.job_id || null,
          begin_time: c.begin_time, end_time: c.end_time,
          normal_hours: c.normal_hours === "" ? null : Number(c.normal_hours),
          ot_hours: c.ot_hours === "" ? null : Number(c.ot_hours),
          site: c.site, job_description: c.job_description, job_ref: c.job_ref,
        };
      });
      const res = await saveTimesheet(date, rows);
      if (res.error) toast({ variant: "destructive", title: "Save failed", description: res.error });
      else { setDirty(false); toast({ title: "Timesheet saved" }); router.refresh(); }
    });

  if (personnel.length === 0) {
    return <div className="border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
      Add personnel in the <strong>Manage Lists</strong> tab first.
    </div>;
  }

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-2">
        <p className="px-2 text-xs text-muted-foreground">
          Costed at each trade&apos;s rate from Settings › Labour Rates; trades with no
          rate of their own fall back to {formatAED(normalRate)} / {formatAED(otRate)} per hour
        </p>
        {editable && (
          <Button size="sm" onClick={save} disabled={!dirty || pending}>
            <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save Timesheet"}
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular">
          <thead>
            <tr className="header-band border-b border-border">
              {["#", "HO No", "Name", "Trade", "Begin", "End", "Nor", "O/T", "T~Hrs", "Site", "Job Name", "Job Description", "Job Ref"].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left font-semibold uppercase">{h}</th>
              ))}
              <th className="px-2 py-1.5 text-right font-semibold uppercase">Cost</th>
            </tr>
          </thead>
          <tbody>
            {personnel.map((p, i) => {
              const c = data[p.id] ?? blank();
              const tHrs = Number(c.normal_hours || 0) + Number(c.ot_hours || 0);
              return (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="px-2 py-0.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-0.5 code-chip">{p.ho_no}</td>
                  <td className="whitespace-nowrap px-2 py-0.5">{p.name}</td>
                  <td className="px-2 py-0.5 text-muted-foreground">{p.trade}</td>
                  {(["begin_time", "end_time"] as const).map((k) => (
                    <td key={k} className="px-0.5 py-0.5">
                      <input disabled={!editable} value={c[k]} onChange={(e) => set(p.id, k, e.target.value)} className={`${cellCss} w-16`} placeholder="--:--" />
                    </td>
                  ))}
                  {(["normal_hours", "ot_hours"] as const).map((k) => (
                    <td key={k} className="px-0.5 py-0.5">
                      <input type="number" step="0.5" disabled={!editable} value={c[k]} onChange={(e) => set(p.id, k, e.target.value)} className={`${cellCss} w-14 text-right`} />
                    </td>
                  ))}
                  <td className="px-2 py-0.5 text-right">{tHrs || ""}</td>
                  <td className="px-0.5 py-0.5">
                    <select disabled={!editable} value={c.site} onChange={(e) => set(p.id, "site", e.target.value)} className={`${cellCss} w-28`}>
                      <option value="" />
                      {sites.map((s) => <option key={s.code} value={s.code} title={s.name}>{s.code}</option>)}
                      {c.site && !sites.some((s) => s.code === c.site) && <option value={c.site}>{c.site}</option>}
                    </select>
                  </td>
                  <td className="px-0.5 py-0.5">
                    <select disabled={!editable} value={c.job_id} onChange={(e) => onJob(p.id, e.target.value)} className={`${cellCss} w-44`}>
                      <option value="" />
                      {jobs.map((j) => <option key={j.id} value={j.id}>{j.job_code}</option>)}
                    </select>
                  </td>
                  <td className="px-0.5 py-0.5">
                    <input disabled={!editable} value={c.job_description} onChange={(e) => set(p.id, "job_description", e.target.value)} className={`${cellCss} w-56`} />
                  </td>
                  <td className="px-0.5 py-0.5">
                    <input disabled={!editable} value={c.job_ref} onChange={(e) => set(p.id, "job_ref", e.target.value)} className={`${cellCss} w-32`} />
                  </td>
                  <td className="px-2 py-0.5 text-right font-medium">{formatAED(cost(p.id, c))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td colSpan={6} className="px-2 py-1.5 text-right uppercase">Totals</td>
              <td className="px-2 py-1.5 text-right">{totalNor || ""}</td>
              <td className="px-2 py-1.5 text-right">{totalOt || ""}</td>
              <td className="px-2 py-1.5 text-right">{(totalNor + totalOt) || ""}</td>
              <td colSpan={4} />
              <td className="px-2 py-1.5 text-right">{formatAED(totalCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
