"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED } from "@/lib/utils";
import { replaceJobLines, type ChildTable, type Row } from "@/app/(app)/jobs/[id]/worksheet/actions";

type LocalRow = Record<string, unknown> & { _key: string; id?: string };

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function WorkforceEditor({
  title,
  jobId,
  table,
  rows,
  editable,
  rates,
  marginPct,
}: {
  title: string;
  jobId: string;
  table: Extract<ChildTable, "job_quote_workforce" | "job_actual_workforce">;
  rows: Row[];
  editable: boolean;
  rates: { designation: string; rate: number }[];
  marginPct: number | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [list, setList] = useState<LocalRow[]>(() =>
    rows.map((r) => ({ ...r, _key: (r.id as string) ?? uid() })),
  );
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const rateFor = (d: string) =>
    rates.find((r) => r.designation === d)?.rate ?? null;

  const set = (key: string, col: string, value: unknown) => {
    setList((rs) =>
      rs.map((r) => {
        if (r._key !== key) return r;
        const next = { ...r, [col]: value };
        // Auto-fill rate when designation changes (if rate empty or still the old designation's rate).
        if (col === "designation") {
          const auto = rateFor(String(value));
          const cur = r.rate_aed_per_hr;
          if (auto != null && (cur === "" || cur == null || cur === rateFor(String(r.designation ?? "")))) {
            next.rate_aed_per_hr = auto;
          }
        }
        return next;
      }),
    );
    setDirty(true);
  };

  const add = () => {
    setList((rs) => [
      ...rs,
      { _key: uid(), designation: "", qty: "", hrs_per_person: "", date: "", rate_aed_per_hr: "" },
    ]);
    setDirty(true);
  };
  const remove = (key: string) => {
    setList((rs) => rs.filter((r) => r._key !== key));
    setDirty(true);
  };

  const cost = (r: LocalRow) =>
    Number(r.qty || 0) * Number(r.hrs_per_person || 0) * Number(r.rate_aed_per_hr || 0);
  const subtotal = list.reduce((s, r) => s + cost(r), 0);
  const total = marginPct != null ? subtotal * (1 + marginPct / 100) : subtotal;

  const save = () =>
    start(async () => {
      const payload: Row[] = list.map(({ _key, ...rest }) => rest as Row);
      const res = await replaceJobLines(jobId, table, payload);
      if (res.error) {
        toast({ variant: "destructive", title: "Save failed", description: res.error });
      } else {
        setDirty(false);
        toast({ title: "Saved", description: title });
        router.refresh();
      }
    });

  return (
    <div className="panel-surface">
      <div className="flex items-center justify-between border-b border-panel-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
        {editable && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7" onClick={add} type="button">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
            <Button size="sm" className="h-7" onClick={save} type="button" disabled={!dirty || pending}>
              <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular">
          <thead>
            <tr className="header-band border-b border-panel-border">
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Designation</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Qty</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Hrs/Person</th>
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Date</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Rate</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Total</th>
              {editable && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={editable ? 7 : 6} className="px-2 py-4 text-center text-panel-foreground/50">
                  No workforce entries.
                </td>
              </tr>
            )}
            {list.map((r) => (
              <tr key={r._key} className="border-b border-panel-border/60">
                <td className="px-1 py-0.5">
                  {editable ? (
                    <select
                      value={(r.designation as string) ?? ""}
                      onChange={(e) => set(r._key, "designation", e.target.value)}
                      className="h-7 w-full border-0 bg-transparent px-1 text-xs outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-steel"
                    >
                      <option value="">—</option>
                      {rates.map((rt) => (
                        <option key={rt.designation} value={rt.designation}>
                          {rt.designation}
                        </option>
                      ))}
                      {typeof r.designation === "string" &&
                        r.designation !== "" &&
                        !rates.some((rt) => rt.designation === r.designation) && (
                          <option value={r.designation}>{r.designation}</option>
                        )}
                    </select>
                  ) : (
                    (r.designation as string) ?? ""
                  )}
                </td>
                {(["qty", "hrs_per_person"] as const).map((c) => (
                  <td key={c} className="px-1 py-0.5">
                    {editable ? (
                      <input
                        type="number"
                        step="0.5"
                        value={(r[c] as string | number) ?? ""}
                        onChange={(e) => set(r._key, c, e.target.value)}
                        className="h-7 w-full border-0 bg-transparent px-1 text-right text-xs outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-steel"
                      />
                    ) : (
                      <span className="block text-right">{(r[c] as string) ?? ""}</span>
                    )}
                  </td>
                ))}
                <td className="px-1 py-0.5">
                  {editable ? (
                    <input
                      type="date"
                      value={(r.date as string) ?? ""}
                      onChange={(e) => set(r._key, "date", e.target.value)}
                      className="h-7 w-full border-0 bg-transparent px-1 text-xs outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-steel"
                    />
                  ) : (
                    (r.date as string) ?? ""
                  )}
                </td>
                <td className="px-1 py-0.5">
                  {editable ? (
                    <input
                      type="number"
                      step="0.01"
                      value={(r.rate_aed_per_hr as string | number) ?? ""}
                      onChange={(e) => set(r._key, "rate_aed_per_hr", e.target.value)}
                      className="h-7 w-full border-0 bg-transparent px-1 text-right text-xs outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-steel"
                    />
                  ) : (
                    <span className="block text-right">{(r.rate_aed_per_hr as string) ?? ""}</span>
                  )}
                </td>
                <td className="px-2 py-0.5 text-right font-medium">{formatAED(cost(r))}</td>
                {editable && (
                  <td className="px-1">
                    <button
                      type="button"
                      onClick={() => remove(r._key)}
                      className="text-panel-foreground/40 hover:text-destructive"
                      title="Remove row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-panel-border">
              <td colSpan={5} className="px-2 py-1.5 text-right text-xs uppercase text-panel-foreground/70">
                Sub-total
              </td>
              <td className="px-2 py-1.5 text-right text-xs font-medium">{formatAED(subtotal)}</td>
              {editable && <td />}
            </tr>
            {marginPct != null && (
              <tr className="border-t border-panel-border font-semibold">
                <td colSpan={5} className="px-2 py-1.5 text-right uppercase">
                  Total (+{marginPct}%)
                </td>
                <td className="px-2 py-1.5 text-right">{formatAED(total)}</td>
                {editable && <td />}
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
