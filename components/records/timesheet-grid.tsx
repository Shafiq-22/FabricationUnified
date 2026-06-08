"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { saveTimesheet, type TimesheetRow } from "@/app/(app)/records/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED } from "@/lib/utils";
import type { Personnel, TimesheetEntry } from "@/lib/types";

type Cell = {
  begin_time: string;
  end_time: string;
  normal_hours: string;
  ot_hours: string;
  site: string;
  job_description: string;
  job_ref: string;
};
const blank = (): Cell => ({ begin_time: "", end_time: "", normal_hours: "", ot_hours: "", site: "", job_description: "", job_ref: "" });

const FIELDS: { key: keyof Cell; label: string; w: string; num?: boolean }[] = [
  { key: "begin_time", label: "Begin", w: "w-20" },
  { key: "end_time", label: "End", w: "w-20" },
  { key: "normal_hours", label: "Nor", w: "w-16", num: true },
  { key: "ot_hours", label: "O/T", w: "w-16", num: true },
  { key: "site", label: "Site", w: "w-28" },
  { key: "job_description", label: "Job Description", w: "w-56" },
  { key: "job_ref", label: "Job Ref No", w: "w-32" },
];

export function TimesheetGrid({
  date, personnel, entries, editable, normalRate, otRate,
}: {
  date: string;
  personnel: Personnel[];
  entries: TimesheetEntry[];
  editable: boolean;
  normalRate: number;
  otRate: number;
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
        begin_time: e.begin_time ?? "", end_time: e.end_time ?? "",
        normal_hours: e.normal_hours == null ? "" : String(e.normal_hours),
        ot_hours: e.ot_hours == null ? "" : String(e.ot_hours),
        site: e.site ?? "", job_description: e.job_description ?? "", job_ref: e.job_ref ?? "",
      };
    }
    return byId;
  });

  const set = (pid: string, key: keyof Cell, v: string) => {
    setData((d) => ({ ...d, [pid]: { ...d[pid], [key]: v } }));
    setDirty(true);
  };
  const cost = (c: Cell) => Number(c.normal_hours || 0) * normalRate + Number(c.ot_hours || 0) * otRate;
  const totalNor = personnel.reduce((s, p) => s + Number(data[p.id]?.normal_hours || 0), 0);
  const totalOt = personnel.reduce((s, p) => s + Number(data[p.id]?.ot_hours || 0), 0);
  const totalCost = personnel.reduce((s, p) => s + cost(data[p.id] ?? blank()), 0);

  const save = () =>
    start(async () => {
      const rows: TimesheetRow[] = personnel.map((p) => {
        const c = data[p.id] ?? blank();
        return {
          personnel_id: p.id,
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
          Normal {formatAED(normalRate)} / OT {formatAED(otRate)} per hour (Settings)
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
              <th className="px-2 py-1.5 text-left font-semibold uppercase">#</th>
              <th className="px-2 py-1.5 text-left font-semibold uppercase">HO No</th>
              <th className="px-2 py-1.5 text-left font-semibold uppercase">Name</th>
              <th className="px-2 py-1.5 text-left font-semibold uppercase">Trade</th>
              {FIELDS.map((f) => <th key={f.key} className="px-2 py-1.5 text-left font-semibold uppercase">{f.label}</th>)}
              <th className="px-2 py-1.5 text-right font-semibold uppercase">T~Hrs</th>
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
                  <td className="px-2 py-0.5">{p.name}</td>
                  <td className="px-2 py-0.5 text-muted-foreground">{p.trade}</td>
                  {FIELDS.map((f) => (
                    <td key={f.key} className="px-0.5 py-0.5">
                      <input
                        type={f.num ? "number" : "text"}
                        step={f.num ? "0.5" : undefined}
                        disabled={!editable}
                        value={c[f.key]}
                        onChange={(e) => set(p.id, f.key, e.target.value)}
                        className={`h-7 ${f.w} max-w-full border border-transparent bg-transparent px-1 outline-none focus:border-input focus:bg-background ${f.num ? "text-right" : ""}`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-0.5 text-right">{tHrs || ""}</td>
                  <td className="px-2 py-0.5 text-right font-medium">{formatAED(cost(c))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td colSpan={6} className="px-2 py-1.5 text-right uppercase">Totals</td>
              <td className="px-2 py-1.5 text-right">{totalNor || ""}</td>
              <td className="px-2 py-1.5 text-right">{totalOt || ""}</td>
              <td colSpan={3} />
              <td className="px-2 py-1.5 text-right">{(totalNor + totalOt) || ""}</td>
              <td className="px-2 py-1.5 text-right">{formatAED(totalCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
