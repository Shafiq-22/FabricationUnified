"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createConsumable,
  updateConsumable,
  deleteConsumable,
} from "@/app/(app)/consumables/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED } from "@/lib/utils";
import { fmtDate } from "@/lib/date";
import type { Consumable } from "@/lib/types";

const buildFields = (
  supplierOptions: { value: string; label: string }[],
): FieldDef[] => [
  { key: "order_date", label: "Order Date", type: "date" },
  {
    key: "supplier_id",
    label: "Supplier",
    type: "select",
    options: [{ value: "none", label: "— None —" }, ...supplierOptions],
  },
  { key: "item_name", label: "Item", required: true, colSpan: 2 },
  { key: "unit", label: "Unit" },
  { key: "qty", label: "Qty", type: "number", step: "0.01" },
  { key: "unit_price", label: "Unit Price (AED)", type: "number", step: "0.01" },
  { key: "pr_no", label: "PR No" },
  { key: "lpo_no", label: "LPO No" },
  { key: "invoice_dn_no", label: "Invoice / DN No" },
  { key: "delivery_date", label: "Delivery Date", type: "date" },
];

export function ConsumablesManager({
  rows,
  editable,
  canDelete,
  supplierOptions,
}: {
  rows: Consumable[];
  editable: boolean;
  canDelete: boolean;
  supplierOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const fields = buildFields(supplierOptions);

  const total = rows.reduce((s, r) => s + (r.total_price ?? 0), 0);

  const remove = (id: string) => {
    if (!confirm("Delete this consumable entry? This can only be done by an admin.")) return;
    start(async () => {
      const res = await deleteConsumable(id);
      if (res.error) toast({ variant: "destructive", title: "Delete failed", description: res.error });
      else {
        toast({ title: "Deleted" });
        router.refresh();
      }
    });
  };

  return (
    <div className="border border-border bg-card">
      {editable && (
        <div className="flex justify-end border-b border-border p-2">
          <RecordFormDialog
            title="New Consumable"
            fields={fields}
            onSubmit={createConsumable}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Add Consumable
              </Button>
            }
          />
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order Date</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Unit Price</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>PR No</TableHead>
            <TableHead>LPO</TableHead>
            <TableHead>Invoice/DN</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Supplier</TableHead>
            {(editable || canDelete) && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={12} className="py-10 text-center text-sm text-muted-foreground">
                No consumables for this period.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(r.order_date)}
              </TableCell>
              <TableCell className="max-w-[16rem] truncate text-xs">{r.item_name}</TableCell>
              <TableCell className="text-xs">{r.unit}</TableCell>
              <TableCell className="text-right tabular text-xs">{r.qty}</TableCell>
              <TableCell className="text-right tabular text-xs">{formatAED(r.unit_price)}</TableCell>
              <TableCell className="text-right tabular text-xs font-medium">
                {formatAED(r.total_price)}
              </TableCell>
              <TableCell className="font-mono text-xs">{r.pr_no}</TableCell>
              <TableCell className="font-mono text-xs">{r.lpo_no}</TableCell>
              <TableCell className="font-mono text-xs">{r.invoice_dn_no}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(r.delivery_date)}
              </TableCell>
              <TableCell className="text-xs">{r.supplier}</TableCell>
              {(editable || canDelete) && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    {editable && (
                      <RecordFormDialog
                        title="Edit Consumable"
                        fields={fields}
                        initial={r as unknown as Record<string, unknown>}
                        onSubmit={(v) => updateConsumable(r.id, v)}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(r.id)}
                        disabled={pending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
        {rows.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="text-right text-xs font-semibold uppercase">
                Month Total
              </TableCell>
              <TableCell className="text-right tabular font-bold">{formatAED(total)}</TableCell>
              <TableCell colSpan={editable || canDelete ? 6 : 5} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
