"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { getDaysInMonth, parseISO } from "date-fns";
import { saveEquipmentUsage, type UsageCell } from "@/app/(app)/records/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED } from "@/lib/utils";
import { EQUIPMENT_STATUS, dayCost } from "@/lib/equipment";
import type { Equipment, EquipmentUsage } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");

export function EquipmentUsageGrid({
  month, equipment, usage, editable,
}: {
  month: string;
  equipment: Equipment[];
  usage: EquipmentUsage[];
  editable: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const days = getDaysInMonth(parseISO(`${month}-01`));
  const dayList = Array.from({ length: days }, (_, i) => i + 1);

  const [data, setData] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const u of usage) {
      const day = Number(u.usage_date.slice(8, 10));
      m[`${u.equipment_id}|${day}`] = u.status_code;
    }
    return m;
  });

  const set = (eid: string, day: number, code: string) => {
    setData((d) => ({ ...d, [`${eid}|${day}`]: code }));
    setDirty(true);
  };

  const rowCost = (e: Equipment) =>
    dayList.reduce((s, day) => s + dayCost(data[`${e.id}|${day}`], e.bare_rate, e.driver_rate), 0);
  const grand = equipment.reduce((s, e) => s + rowCost(e), 0);

  const save = () =>
    start(async () => {
      const cells: UsageCell[] = [];
      for (const e of equipment) {
        for (const day of dayList) {
          const code = data[`${e.id}|${day}`];
          if (code) cells.push({ equipment_id: e.id, date: `${month}-${pad(day)}`, status_code: code });
        }
      }
      const res = await saveEquipmentUsage(month, cells);
      if (res.error) toast({ variant: "destructive", title: "Save failed", description: res.error });
      else { setDirty(false); toast({ title: "Equipment record saved" }); router.refresh(); }
    });

  if (equipment.length === 0) {
    return <div className="border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
      Add equipment in the <strong>Manage Lists</strong> tab first.
    </div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Pick a status code per day; cost = B-factor × bare + D-factor × driver.</p>
        {editable && (
          <Button size="sm" onClick={save} disabled={!dirty || pending}>
            <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save Record"}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto border border-border bg-card">
        <table className="text-[11px] tabular">
          <thead>
            <tr className="header-band border-b border-border">
              <th className="sticky left-0 z-10 bg-secondary px-2 py-1.5 text-left font-semibold uppercase">Sixco / Machine</th>
              {dayList.map((d) => <th key={d} className="w-9 px-0.5 py-1.5 text-center font-semibold">{d}</th>)}
              <th className="px-2 py-1.5 text-right font-semibold uppercase">Cost</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((e) => (
              <tr key={e.id} className="border-b border-border/60">
                <td className="sticky left-0 z-10 max-w-[14rem] truncate bg-card px-2 py-0.5">
                  <span className="code-chip text-steel">{e.sixco_no}</span>{" "}
                  <span className="text-muted-foreground">{e.machine}</span>
                </td>
                {dayList.map((day) => {
                  const code = data[`${e.id}|${day}`] ?? "";
                  return (
                    <td key={day} className="p-0">
                      {editable ? (
                        <select
                          value={code}
                          onChange={(ev) => set(e.id, day, ev.target.value)}
                          className="h-7 w-9 appearance-none border border-transparent bg-transparent text-center outline-none focus:border-input focus:bg-background"
                          title={code ? EQUIPMENT_STATUS.find((s) => s.code === code)?.desc : ""}
                        >
                          <option value="" />
                          {EQUIPMENT_STATUS.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
                        </select>
                      ) : (
                        <span className="block text-center">{code}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-0.5 text-right font-medium">{formatAED(rowCost(e))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td className="sticky left-0 z-10 bg-card px-2 py-1.5 text-right uppercase" colSpan={1}>Total</td>
              <td colSpan={dayList.length} />
              <td className="px-2 py-1.5 text-right">{formatAED(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Status legend */}
      <div className="border border-border bg-card p-3">
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status Codes (Bare ; Driver)</h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] md:grid-cols-3 lg:grid-cols-4">
          {EQUIPMENT_STATUS.map((s) => (
            <div key={s.code} className="flex items-baseline gap-1.5">
              <span className="w-7 font-mono font-bold text-steel">{s.code}</span>
              <span className="text-muted-foreground">{s.desc} <span className="font-mono">({s.b};{s.d})</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
