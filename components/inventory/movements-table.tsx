"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteMovement } from "@/app/(app)/inventory/actions";
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
import { fmtDate } from "@/lib/date";
import type { InventoryMovement } from "@/lib/types";

const VARIANT: Record<string, "com" | "inp" | "qtn" | "del"> = {
  receipt: "com",
  issue: "inp",
  remnant: "del",
  adjustment: "qtn",
};

export function MovementsTable({
  rows,
  itemNames,
  jobCodes,
  canDelete,
}: {
  rows: InventoryMovement[];
  itemNames: Record<string, string>;
  jobCodes: Record<string, string>;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteMovement(id);
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: "Movement deleted" });
        router.refresh();
      }
    });

  return (
    <div className="border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
        Stock ledger — on-hand quantities are derived from these movements ({rows.length})
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Note</TableHead>
            {canDelete && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canDelete ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">
                No stock movements recorded yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(m.moved_on)}
              </TableCell>
              <TableCell className="max-w-[18rem] truncate text-xs">
                {itemNames[m.inventory_item_id] ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant={VARIANT[m.movement_type] ?? "secondary"}>{m.movement_type}</Badge>
              </TableCell>
              <TableCell
                className={`text-right tabular text-xs font-semibold ${
                  Number(m.qty) < 0 ? "text-destructive" : "text-status-com"
                }`}
              >
                {Number(m.qty) > 0 ? `+${m.qty}` : m.qty}
              </TableCell>
              <TableCell className="font-mono text-xs text-steel">
                {m.job_id ? jobCodes[m.job_id] ?? "—" : "—"}
              </TableCell>
              <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                {m.note ?? "—"}
              </TableCell>
              {canDelete && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => {
                      if (confirm("Delete this movement? On-hand quantity will be recalculated."))
                        remove(m.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
