"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED } from "@/lib/utils";
import type { Row } from "@/app/(app)/jobs/[id]/worksheet/actions";

export interface EditCol {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "checkbox";
  align?: "left" | "right";
  step?: string;
  placeholder?: string;
  /** Choices for `type: "select"`. An empty value is always offered first. */
  options?: { value: string; label: string }[];
  /** Placeholder label for the empty choice of a select. */
  emptyOption?: string;
}

type LocalRow = Record<string, unknown> & { _key: string; id?: string };

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function EditableTable({
  title,
  columns,
  initialRows,
  editable,
  onSave,
  computeTotal,
  totalKind = "money",
  emptyHint = "No rows yet.",
  marginPct = null,
  groupBy,
  derive,
}: {
  title: string;
  columns: EditCol[];
  initialRows: Row[];
  editable: boolean;
  onSave: (rows: Row[]) => Promise<{ error: string | null }>;
  computeTotal?: (row: Record<string, unknown>) => number;
  totalKind?: "money" | "number";
  emptyHint?: string;
  marginPct?: number | null;
  /** Column to band the rows by, e.g. part_ref for Job -> Part -> items. */
  groupBy?: string;
  /**
   * Fill in sibling cells when one changes — e.g. picking a stock item also
   * sets the unit cost. Returns the extra fields to merge into the row.
   */
  derive?: (
    col: string,
    value: unknown,
    row: Record<string, unknown>,
  ) => Record<string, unknown> | null | undefined;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<LocalRow[]>(() =>
    initialRows.map((r) => ({ ...r, _key: (r.id as string) ?? uid() })),
  );
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const set = (key: string, col: string, value: unknown) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r._key !== key) return r;
        const next = { ...r, [col]: value };
        return { ...next, ...(derive?.(col, value, next) ?? {}) };
      }),
    );
    setDirty(true);
  };
  const add = () => {
    const blank: LocalRow = { _key: uid() };
    columns.forEach((c) => (blank[c.key] = ""));
    setRows((rs) => [...rs, blank]);
    setDirty(true);
  };
  const remove = (key: string) => {
    setRows((rs) => rs.filter((r) => r._key !== key));
    setDirty(true);
  };

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

  const fmt = (n: number) => (totalKind === "money" ? formatAED(n) : String(n));
  const total = computeTotal
    ? rows.reduce((s, r) => s + (computeTotal(r) || 0), 0)
    : null;
  const colSpan = columns.length + (computeTotal ? 1 : 0) + (editable ? 1 : 0);

  // Rows in display order, with a banner row wherever the group changes.
  // Grouping is presentational only — the saved order is still `rows`.
  const ordered = (() => {
    if (!groupBy) return rows.map((r) => ({ row: r, banner: null as string | null }));
    const groups = new Map<string, LocalRow[]>();
    for (const r of rows) {
      const key = String(r[groupBy] ?? "").trim();
      const bucket = groups.get(key);
      if (bucket) bucket.push(r);
      else groups.set(key, [r]);
    }
    const out: { row: LocalRow; banner: string | null }[] = [];
    for (const [key, list] of Array.from(groups.entries())) {
      list.forEach((r, i) => out.push({ row: r, banner: i === 0 ? key : null }));
    }
    return out;
  })();

  const groupTotal = (key: string) =>
    computeTotal
      ? rows
          .filter((r) => String(r[groupBy!] ?? "").trim() === key)
          .reduce((s, r) => s + (computeTotal(r) || 0), 0)
      : null;

  return (
    <div className="panel-surface">
      <div className="flex items-center justify-between border-b border-panel-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
        {editable && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7" onClick={add} type="button">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
            <Button
              size="sm"
              className="h-7"
              onClick={save}
              type="button"
              disabled={!dirty || pending}
            >
              <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular">
          <thead>
            <tr className="header-band border-b border-panel-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="px-2 py-1.5 text-center font-semibold uppercase tracking-wide"
                >
                  {c.label}
                </th>
              ))}
              {computeTotal && (
                <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wide">
                  Total
                </th>
              )}
              {editable && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-2 py-4 text-center text-panel-foreground/50">
                  {emptyHint}
                </td>
              </tr>
            )}
            {ordered.map(({ row: r, banner }) => (
              <Fragment key={r._key}>
              {banner !== null && (
                <tr className="bg-secondary/60">
                  <td
                    colSpan={colSpan}
                    className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
                  >
                    {banner || "Unassigned part"}
                    {computeTotal && (
                      <span className="ml-2 font-normal text-panel-foreground/60">
                        {fmt(groupTotal(banner) || 0)}
                      </span>
                    )}
                  </td>
                </tr>
              )}
              <tr className="border-b border-panel-border/60">
                {columns.map((c) => (
                  <td key={c.key} className="px-1 py-0.5">
                    {!editable ? (
                      <span className={c.align === "right" ? "block text-right" : ""}>
                        {c.type === "checkbox"
                          ? r[c.key]
                            ? "Yes"
                            : "—"
                          : c.type === "select"
                            ? (c.options?.find((o) => o.value === r[c.key])?.label ?? "")
                            : ((r[c.key] as string) ?? "")}
                      </span>
                    ) : c.type === "checkbox" ? (
                      <input
                        type="checkbox"
                        checked={r[c.key] === true || r[c.key] === "true"}
                        onChange={(e) => set(r._key, c.key, e.target.checked)}
                        className="mx-auto block h-3.5 w-3.5 accent-steel"
                      />
                    ) : c.type === "select" ? (
                      <select
                        value={(r[c.key] as string | undefined) ?? ""}
                        onChange={(e) => set(r._key, c.key, e.target.value)}
                        className="h-7 w-full border-0 bg-transparent px-1 text-xs outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-steel"
                      >
                        <option value="">{c.emptyOption ?? "—"}</option>
                        {(c.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={c.type ?? "text"}
                        step={c.step}
                        value={(r[c.key] as string | number | undefined) ?? ""}
                        placeholder={c.placeholder}
                        onChange={(e) => set(r._key, c.key, e.target.value)}
                        className={`h-7 w-full border-0 bg-transparent px-1 text-xs outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-steel ${
                          c.align === "right" ? "text-right" : ""
                        }`}
                      />
                    )}
                  </td>
                ))}
                {computeTotal && (
                  <td className="px-2 py-0.5 text-right font-medium">
                    {fmt(computeTotal(r) || 0)}
                  </td>
                )}
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
              </Fragment>
            ))}
          </tbody>
          {total != null && (
            <tfoot>
              {marginPct != null ? (
                <>
                  <tr className="border-t border-panel-border">
                    <td colSpan={columns.length} className="px-2 py-1.5 text-right text-xs uppercase text-panel-foreground/70">
                      Sub-total
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-medium">{fmt(total)}</td>
                    {editable && <td />}
                  </tr>
                  <tr className="border-t border-panel-border font-semibold">
                    <td colSpan={columns.length} className="px-2 py-1.5 text-right uppercase">
                      Total (+{marginPct}%)
                    </td>
                    <td className="px-2 py-1.5 text-right">{fmt(total * (1 + marginPct / 100))}</td>
                    {editable && <td />}
                  </tr>
                </>
              ) : (
                <tr className="border-t border-panel-border font-semibold">
                  <td colSpan={columns.length} className="px-2 py-1.5 text-right uppercase">
                    {title} total
                  </td>
                  <td className="px-2 py-1.5 text-right">{fmt(total)}</td>
                  {editable && <td />}
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
