import { getDaysInMonth, parseISO } from "date-fns";
import type { Personnel, TimesheetEntry } from "@/lib/types";

const PALETTE = [
  "#bfdbfe", "#bbf7d0", "#fed7aa", "#fde68a", "#ddd6fe",
  "#fbcfe8", "#a5f3fc", "#d9f99d", "#fecaca", "#c7d2fe",
  "#99f6e4", "#fef08a", "#e9d5ff", "#fdba74", "#a7f3d0",
];

// Read-only monthly view: hours per personnel per day, cells coloured by job.
export function TimesheetMonthly({
  month,
  personnel,
  entries,
  jobCodes,
}: {
  month: string;
  personnel: Personnel[];
  entries: TimesheetEntry[];
  jobCodes: Record<string, string>;
}) {
  const days = getDaysInMonth(parseISO(`${month}-01`));
  const dayList = Array.from({ length: days }, (_, i) => i + 1);

  // distinct jobs present -> colour
  const jobIds = Array.from(
    new Set(entries.map((e) => e.job_id).filter((x): x is string => !!x)),
  );
  const colorOf = (jobId: string | null) =>
    jobId ? PALETTE[jobIds.indexOf(jobId) % PALETTE.length] : "#e5e7eb";

  // map[personnel][day] -> entry
  const map: Record<string, Record<number, TimesheetEntry>> = {};
  for (const e of entries) {
    const day = Number(e.entry_date.slice(8, 10));
    (map[e.personnel_id] ??= {})[day] = e;
  }
  const hoursOf = (e: TimesheetEntry) =>
    (e.normal_hours ?? 0) + (e.ot_hours ?? 0);
  const rowTotal = (pid: string) =>
    Object.values(map[pid] ?? {}).reduce((s, e) => s + hoursOf(e), 0);

  if (personnel.length === 0) {
    return <div className="border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
      Add personnel in the <strong>Manage Lists</strong> tab first.
    </div>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-border bg-card">
        <table className="text-[11px] tabular">
          <thead>
            <tr className="header-band border-b border-border">
              <th className="sticky left-0 z-10 bg-secondary px-2 py-1.5 text-left font-semibold uppercase">Name</th>
              {dayList.map((d) => <th key={d} className="w-7 px-0.5 py-1.5 text-center font-semibold">{d}</th>)}
              <th className="px-2 py-1.5 text-right font-semibold uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            {personnel.map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-0.5">
                  {p.name} <span className="text-muted-foreground">{p.trade}</span>
                </td>
                {dayList.map((day) => {
                  const e = map[p.id]?.[day];
                  if (!e) return <td key={day} className="px-0.5 py-0.5 text-center text-muted-foreground/40">·</td>;
                  const h = hoursOf(e);
                  return (
                    <td
                      key={day}
                      className="px-0.5 py-0.5 text-center font-medium text-panel-foreground"
                      style={{ backgroundColor: colorOf(e.job_id) }}
                      title={e.job_id ? jobCodes[e.job_id] : e.job_description ?? ""}
                    >
                      {h || ""}
                    </td>
                  );
                })}
                <td className="px-2 py-0.5 text-right font-semibold">{rowTotal(p.id) || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jobIds.length > 0 && (
        <div className="border border-border bg-card p-3">
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Job Colour Key</h4>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px]">
            {jobIds.map((id) => (
              <div key={id} className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm border border-border" style={{ backgroundColor: colorOf(id) }} />
                <span className="font-mono">{jobCodes[id] ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
