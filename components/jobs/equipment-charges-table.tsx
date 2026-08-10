"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED } from "@/lib/utils";
import type { Row } from "@/app/(app)/jobs/[id]/worksheet/actions";

export interface EquipmentOption {
  id: string;
  label: string;
  bare: number;
  driver: number;
}

type LocalRow = Record<string, unknown> & { _key: string };

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Equipment charges. Picking a machine from the Personnel & Equipment
 * register fills the rate from that record — bare or with driver — so the
 * two places never drift apart. Plant that is not on the register can still
 * be typed in free-hand with its own rate.
 */
export function EquipmentTable({
  title,
  rows: initialRows,
  options,
  editable,
  onSave,
  marginPct,
}: {
  title: string;
  rows: Row[];
  options: EquipmentOption[];
  editable: boolean;
  onSave: (rows: Row[]) => Promise<{ error: string | null }>;
  marginPct: number | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<LocalRow[]>(() =>
    initialRows.map((r) => ({ ...r, _key: (r.id as string) ?? uid() })),
  );
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const set = (key: string, col: string, value: unknown) => {
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, [col]: value } : r)));
    setDirty(true);
  };

  /** Machine or driver-flag changed: re-read the rate from the register. */
  const applyRate = (key: string, equipmentId: string, withDriver: boolean) => {
    const opt = options.find((o) => o.id === equipmentId);
    setRows((rs) =>
      rs.map((r) =>
        r._key === key
          ? {
              ...r,
              equipment_id: equipmentId || null,
              with_driver: withDriver,
              description: opt ? opt.label : r.description,
              rate_aed_per_hr: opt ? (withDriver ? opt.driver : opt.bare) : r.rate_aed_per_hr,
            }
          : r,
      ),
    );
    setDirty(true);
  };

  const lineTotal = (r: LocalRow) =>
    Number(r.hours || 0) * Number(r.rate_aed_per_hr || 0);
  const total = rows.reduce((s, r) => s + lineTotal(r), 0);

  const save = () =>
    start(async () => {
      const payload: Row[] = rows.map(({ _key, ...rest }) => rest as Row);
      const res = await onSave(payload);
      if (res?.error) {
        toast({ variant: "destructive", title: "Save failed", description: res.error });
      } else {
        setDirty(false);
        toast({ title: "Saved", description: title });
        router.refresh();
      }
    });

  // Banner wherever the part changes, matching the other worksheet tables.
  const ordered = (() => {
    const groups = new Map<string, LocalRow[]>();
    for (const r of rows) {
      const k = String(r.part_ref ?? "").trim();
      const b = groups.get(k);
      if (b) b.push(r);
      else groups.set(k, [r]);
    }
    const out: { row: LocalRow; banner: string | null }[] = [];
    for (const [k, list] of Array.from(groups.entries()))
      list.forEach((r, i) => out.push({ row: r, banner: i === 0 ? k : null }));
    return out;
  })();

  const cell =
    "h-7 w-full border-0 bg-transparent px-1 text-xs outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-steel";
  const colSpan = 6 + (editable ? 1 : 0);

  return (
    <div className="panel-surface">
      <div className="flex items-center justify-between border-b border-panel-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
        {editable && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              type="button"
              onClick={() => {
                setRows((rs) => [
                  ...rs,
                  { _key: uid(), part_ref: "", description: "", hours: "", rate_aed_per_hr: "", with_driver: false },
                ]);
                setDirty(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
            <Button size="sm" className="h-7" type="button" onClick={save} disabled={!dirty || pending}>
              <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular">
          <thead>
            <tr className="header-band border-b border-panel-border">
              <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wide">Part No. / Name</th>
              <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wide">Machine</th>
              <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wide">Driver</th>
              <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wide">Hours</th>
              <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wide">Rate/hr</th>
              <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wide">Total</th>
              {editable && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-2 py-4 text-center text-panel-foreground/50">
                  No equipment charged to this job yet.
                </td>
              </tr>
            )}
            {ordered.map(({ row: r, banner }) => (
              <Fragment key={r._key}>
                {banner !== null && (
                  <tr className="bg-secondary/60">
                    <td colSpan={colSpan} className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
                      {banner || "Unassigned part"}
                    </td>
                  </tr>
                )}
                <tr className="border-b border-panel-border/60">
                  <td className="px-1 py-0.5">
                    {editable ? (
                      <input
                        className={cell}
                        value={(r.part_ref as string) ?? ""}
                        placeholder="e.g. P-01"
                        onChange={(e) => set(r._key, "part_ref", e.target.value)}
                      />
                    ) : (
                      ((r.part_ref as string) ?? "")
                    )}
                  </td>
                  <td className="px-1 py-0.5">
                    {editable ? (
                      <div className="flex items-center gap-1">
                        <select
                          className={`${cell} max-w-[9rem]`}
                          value={(r.equipment_id as string) ?? ""}
                          onChange={(e) =>
                            applyRate(r._key, e.target.value, Boolean(r.with_driver))
                          }
                        >
                          <option value="">— Not registered —</option>
                          {options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className={cell}
                          value={(r.description as string) ?? ""}
                          placeholder="Description"
                          onChange={(e) => set(r._key, "description", e.target.value)}
                        />
                      </div>
                    ) : (
                      ((r.description as string) ?? "")
                    )}
                  </td>
                  <td className="px-1 py-0.5 text-center">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                      disabled={!editable}
                      checked={Boolean(r.with_driver)}
                      onChange={(e) =>
                        applyRate(r._key, (r.equipment_id as string) ?? "", e.target.checked)
                      }
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      type="number"
                      step="0.01"
                      className={`${cell} text-right`}
                      disabled={!editable}
                      value={(r.hours as string | number | undefined) ?? ""}
                      onChange={(e) => set(r._key, "hours", e.target.value)}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      type="number"
                      step="0.01"
                      className={`${cell} text-right`}
                      disabled={!editable}
                      value={(r.rate_aed_per_hr as string | number | undefined) ?? ""}
                      onChange={(e) => set(r._key, "rate_aed_per_hr", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-0.5 text-right font-medium">{formatAED(lineTotal(r))}</td>
                  {editable && (
                    <td className="px-1">
                      <button
                        type="button"
                        title="Remove row"
                        className="text-panel-foreground/40 hover:text-destructive"
                        onClick={() => {
                          setRows((rs) => rs.filter((x) => x._key !== r._key));
                          setDirty(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            {marginPct != null ? (
              <>
                <tr className="border-t border-panel-border">
                  <td colSpan={5} className="px-2 py-1.5 text-right text-xs uppercase text-panel-foreground/70">
                    Sub-total
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs font-medium">{formatAED(total)}</td>
                  {editable && <td />}
                </tr>
                <tr className="border-t border-panel-border font-semibold">
                  <td colSpan={5} className="px-2 py-1.5 text-right uppercase">
                    Total (+{marginPct}%)
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {formatAED(total * (1 + marginPct / 100))}
                  </td>
                  {editable && <td />}
                </tr>
              </>
            ) : (
              <tr className="border-t border-panel-border font-semibold">
                <td colSpan={5} className="px-2 py-1.5 text-right uppercase">
                  {title} total
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
