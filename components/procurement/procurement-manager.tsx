"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createJobMaterial,
  updateJobMaterial,
  deleteJobMaterial,
} from "@/app/(app)/procurement/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
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
import { fmtDate } from "@/lib/date";
import type { JobMaterial } from "@/lib/types";

export function ProcurementManager({
  rows,
  jobOptions,
  jobCodes,
  editable,
  canDelete,
  supplierOptions,
}: {
  rows: JobMaterial[];
  jobOptions: { value: string; label: string }[];
  jobCodes: Record<string, string>;
  editable: boolean;
  canDelete: boolean;
  supplierOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const fields: FieldDef[] = [
    { key: "request_date", label: "Request Date", type: "date" },
    { key: "order_date", label: "Order Date", type: "date" },
    {
      key: "job_id",
      label: "Job",
      type: "select",
      options: [{ value: "none", label: "— No job —" }, ...jobOptions],
      colSpan: 2,
    },
    { key: "item_name", label: "Item", required: true, colSpan: 2 },
    { key: "dimension", label: "Dimension", placeholder: "e.g. 100x100x5" },
    { key: "grade", label: "Grade", placeholder: "S275 / S355…" },
    { key: "unit", label: "Unit", placeholder: "bars (6m) / sheets / kg" },
    { key: "qty", label: "Qty", type: "number", step: "0.01" },
    { key: "unit_price", label: "Unit Price (AED)", type: "number", step: "0.01" },
    {
      key: "supplier_id",
      label: "Supplier",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...supplierOptions],
    },
    { key: "pr_no", label: "PR No" },
    { key: "lpo_no", label: "LPO No" },
    { key: "invoice_dn_no", label: "Invoice / DN No" },
    { key: "delivery_date", label: "Delivery Date", type: "date" },
  ];

  const remove = (id: string) => {
    if (!confirm("Delete this procurement entry?")) return;
    start(async () => {
      const res = await deleteJobMaterial(id);
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
            title="New Material Request"
            fields={fields}
            onSubmit={createJobMaterial}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Add Request
              </Button>
            }
          />
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order Date</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Unit Price</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Lead (d)</TableHead>
            <TableHead>Status</TableHead>
            {(editable || canDelete) && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                No procurement records match the filters.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(r.order_date)}
              </TableCell>
              <TableCell className="font-mono text-xs text-steel">
                {r.job_id ? jobCodes[r.job_id] ?? "—" : "—"}
              </TableCell>
              <TableCell className="max-w-[16rem] truncate text-xs">
                {r.item_name}
                {(r.dimension || r.grade) && (
                  <span className="ml-1 text-muted-foreground">
                    {[r.dimension, r.grade].filter(Boolean).join(" · ")}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular text-xs">
                {r.qty} {r.unit ?? ""}
              </TableCell>
              <TableCell className="text-right tabular text-xs">{formatAED(r.unit_price)}</TableCell>
              <TableCell className="text-right tabular text-xs font-medium">
                {formatAED(r.total_price)}
              </TableCell>
              <TableCell className="text-xs">{r.supplier}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(r.delivery_date)}
              </TableCell>
              <TableCell className="text-right tabular text-xs">
                {r.time_to_deliver_days ?? "—"}
              </TableCell>
              <TableCell>
                {r.delivery_date ? (
                  <Badge variant="com">Delivered</Badge>
                ) : (
                  <Badge variant="inp">Pending</Badge>
                )}
              </TableCell>
              {(editable || canDelete) && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    {editable && (
                      <RecordFormDialog
                        title="Edit Material Request"
                        fields={fields}
                        initial={r as unknown as Record<string, unknown>}
                        onSubmit={(v) => updateJobMaterial(r.id, v)}
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
      </Table>
    </div>
  );
}
