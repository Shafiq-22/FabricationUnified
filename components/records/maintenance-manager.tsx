"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createMaintenance,
  deleteMaintenance,
  setEquipmentStatus,
} from "@/app/(app)/qa/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED } from "@/lib/utils";
import { fmtDate } from "@/lib/date";
import {
  MAINTENANCE_TYPES,
  EQUIPMENT_STATES,
  type MaintenanceRecord,
  type Equipment,
} from "@/lib/types";

export function MaintenanceManager({
  rows,
  equipment,
  personnelOptions,
  personnelNames,
  showMoney,
  canEdit,
  canDelete,
}: {
  rows: MaintenanceRecord[];
  equipment: Equipment[];
  personnelOptions: { value: string; label: string }[];
  personnelNames: Record<string, string>;
  showMoney: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: ok });
        router.refresh();
      }
    });

  const equipNames: Record<string, string> = Object.fromEntries(
    equipment.map((e) => [e.id, `${e.sixco_no ?? ""} ${e.machine}`.trim()]),
  );

  const fields: FieldDef[] = [
    {
      key: "equipment_id",
      label: "Equipment",
      type: "select",
      options: equipment.map((e) => ({
        value: e.id,
        label: `${e.sixco_no ?? ""} ${e.machine}`.trim(),
      })),
      required: true,
      colSpan: 2,
    },
    {
      key: "maintenance_type",
      label: "Type",
      type: "select",
      options: MAINTENANCE_TYPES.map((t) => ({ value: t.value, label: t.label })),
      required: true,
    },
    { key: "performed_on", label: "Date", type: "date" },
    {
      key: "performed_by",
      label: "Performed By",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...personnelOptions],
    },
    { key: "downtime_hours", label: "Downtime (hrs)", type: "number", step: "0.25" },
    { key: "cost", label: "Cost (AED)", type: "number", step: "0.01" },
    { key: "description", label: "Description", colSpan: 2 },
  ];

  const totalDowntime = rows.reduce((s, r) => s + Number(r.downtime_hours ?? 0), 0);
  const totalCost = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Equipment status overview */}
      <section className="border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Equipment Status
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sixco No</TableHead>
              <TableHead>Machine</TableHead>
              <TableHead>Last Service</TableHead>
              <TableHead className="w-44">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                  No equipment yet — add some in Manage Lists.
                </TableCell>
              </TableRow>
            )}
            {equipment.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="code-chip">{e.sixco_no ?? "—"}</TableCell>
                <TableCell className="text-xs">{e.machine}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {fmtDate(e.last_service_date)}
                </TableCell>
                <TableCell>
                  {canEdit ? (
                    <Select
                      value={e.status}
                      disabled={pending}
                      onValueChange={(v) => run(() => setEquipmentStatus(e.id, v), "Status updated")}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_STATES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant={
                        (EQUIPMENT_STATES.find((s) => s.value === e.status)?.badge ??
                          "secondary") as "com" | "inp" | "hal" | "secondary"
                      }
                    >
                      {e.status}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Maintenance log */}
      <section className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-2">
          <p className="px-2 text-xs text-muted-foreground">
            Maintenance history ({rows.length}) — builds the record needed for future
            MTBF/MTTR analysis.
          </p>
          {canEdit && equipment.length > 0 && (
            <RecordFormDialog
              title="Log Maintenance"
              fields={fields}
              onSubmit={createMaintenance}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Log Maintenance
                </Button>
              }
            />
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="text-right">Downtime</TableHead>
              {showMoney && <TableHead className="text-right">Cost</TableHead>}
              {canDelete && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={showMoney ? (canDelete ? 8 : 7) : canDelete ? 7 : 6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No maintenance logged yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {fmtDate(m.performed_on)}
                </TableCell>
                <TableCell className="max-w-[14rem] truncate text-xs">
                  {equipNames[m.equipment_id] ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={m.maintenance_type === "breakdown" ? "hal" : "secondary"}>
                    {m.maintenance_type}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                  {m.description ?? "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {m.performed_by ? personnelNames[m.performed_by] ?? "—" : "—"}
                </TableCell>
                <TableCell className="text-right tabular text-xs">
                  {m.downtime_hours ?? "—"}
                </TableCell>
                {showMoney && (
                  <TableCell className="text-right tabular text-xs">{formatAED(m.cost)}</TableCell>
                )}
                {canDelete && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={pending}
                      onClick={() => {
                        if (confirm("Delete this maintenance record?"))
                          run(() => deleteMaintenance(m.id), "Deleted");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <tfoot>
              <TableRow className="font-semibold">
                <TableCell colSpan={5} className="text-right text-xs uppercase">
                  Totals
                </TableCell>
                <TableCell className="text-right tabular text-xs">{totalDowntime || "—"}</TableCell>
                {showMoney && (
                  <TableCell className="text-right tabular text-xs">{formatAED(totalCost)}</TableCell>
                )}
                {canDelete && <TableCell />}
              </TableRow>
            </tfoot>
          )}
        </Table>
      </section>
    </div>
  );
}
