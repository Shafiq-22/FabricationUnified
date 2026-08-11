"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, ArrowLeftRight } from "lucide-react";
import {
  createInventoryItem,
  updateInventoryItem,
  toggleInventoryItem,
  deleteInventoryItem,
  addMovement,
} from "@/app/(app)/inventory/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { INVENTORY_TYPES, MOVEMENT_TYPES, type InventoryItemView } from "@/lib/types";

const itemFields: FieldDef[] = [
  { key: "item_code", label: "Item Code" },
  {
    key: "item_type",
    label: "Type",
    type: "select",
    options: INVENTORY_TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) })),
    required: true,
  },
  { key: "description", label: "Description", required: true, colSpan: 2 },
  { key: "material_grade", label: "Material Grade", placeholder: "e.g. S355" },
  { key: "dimensions", label: "Dimensions", placeholder: "e.g. 100x100x5 / 2000x6000x10" },
  { key: "unit", label: "Unit", placeholder: "pcs / m / kg" },
  { key: "warehouse_location", label: "Location" },
  { key: "reorder_threshold", label: "Reorder Below", type: "number", step: "0.001" },
  { key: "unit_cost", label: "Unit Cost (AED)", type: "number", step: "0.01" },
];

export function InventoryManager({
  rows,
  showMoney,
  canEdit,
  canDelete,
  jobOptions,
}: {
  rows: InventoryItemView[];
  showMoney: boolean;
  canEdit: boolean;
  canDelete: boolean;
  jobOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyLow && !r.low_stock) return false;
      if (!term) return true;
      return [r.item_code, r.description, r.material_grade, r.dimensions, r.warehouse_location]
        .some((f) => (f ?? "").toLowerCase().includes(term));
    });
  }, [q, onlyLow, rows]);

  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: ok });
        router.refresh();
      }
    });

  const moveFields: FieldDef[] = [
    {
      key: "movement_type",
      label: "Movement",
      type: "select",
      options: MOVEMENT_TYPES.map((m) => ({ value: m.value, label: m.label })),
      required: true,
      colSpan: 2,
    },
    { key: "qty", label: "Quantity", type: "number", step: "0.001", required: true },
    { key: "moved_on", label: "Date", type: "date" },
    {
      key: "job_id",
      label: "Job (optional)",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...jobOptions],
      colSpan: 2,
    },
    { key: "note", label: "Note", colSpan: 2 },
  ];

  const lowCount = rows.filter((r) => r.low_stock).length;

  return (
    <div className="border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stock…"
              className="h-8 w-64 pl-7 text-xs"
            />
          </div>
          <Button
            variant={onlyLow ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setOnlyLow((v) => !v)}
          >
            Low stock ({lowCount})
          </Button>
        </div>
        {canEdit && (
          <RecordFormDialog
            title="Add Stock Item"
            fields={itemFields}
            onSubmit={createInventoryItem}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            }
          />
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Dimensions</TableHead>
            <TableHead>On Hand</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Location</TableHead>
            {showMoney && <TableHead>Unit Cost</TableHead>}
            {showMoney && <TableHead>Value</TableHead>}
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={showMoney ? 11 : 9} className="py-10 text-center text-sm text-muted-foreground">
                {rows.length === 0 ? "No stock items yet — add one to start tracking." : "Nothing matches those filters."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((r) => (
            <TableRow key={r.id ?? ""} className={r.active === false ? "opacity-50" : undefined}>
              <TableCell className="code-chip">{r.item_code ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={r.item_type === "remnant" ? "inp" : "secondary"}>{r.item_type}</Badge>
              </TableCell>
              <TableCell className="text-left max-w-[18rem] truncate text-xs">{r.description}</TableCell>
              <TableCell className="text-xs">{r.material_grade ?? "—"}</TableCell>
              <TableCell className="text-xs">{r.dimensions ?? "—"}</TableCell>
              <TableCell
                className={`text-right tabular text-xs font-semibold ${r.low_stock ? "text-destructive" : ""}`}
                title={r.low_stock ? `At or below reorder level (${r.reorder_threshold})` : undefined}
              >
                {r.quantity_on_hand}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.unit ?? "—"}</TableCell>
              <TableCell className="text-xs">{r.warehouse_location ?? "—"}</TableCell>
              {showMoney && (
                <TableCell className="text-right tabular text-xs">{formatAED(r.unit_cost)}</TableCell>
              )}
              {showMoney && (
                <TableCell className="text-right tabular text-xs font-medium">{formatAED(r.stock_value)}</TableCell>
              )}
              <TableCell>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <RecordFormDialog
                      title={`Stock movement — ${r.description ?? ""}`}
                      fields={moveFields}
                      onSubmit={(v) => addMovement({ ...v, inventory_item_id: r.id ?? "" })}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Record movement">
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <RecordFormDialog
                      title="Edit Stock Item"
                      fields={itemFields}
                      initial={r as unknown as Record<string, unknown>}
                      onSubmit={(v) => updateInventoryItem(r.id ?? "", v)}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={pending}
                      onClick={() => run(() => toggleInventoryItem(r.id ?? "", !r.active), "Updated")}
                    >
                      {r.active ? "Disable" : "Enable"}
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => {
                          if (confirm("Delete this stock item and its movement history?"))
                            run(() => deleteInventoryItem(r.id ?? ""), "Deleted");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
