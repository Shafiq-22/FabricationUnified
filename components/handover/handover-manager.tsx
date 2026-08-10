"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, FileText, Send } from "lucide-react";
import {
  createHandover,
  updateHandover,
  deleteHandover,
  addDrawing,
  deleteDrawing,
} from "@/app/(app)/handover/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/hooks/use-toast";
import { fmtDate } from "@/lib/date";
import { transferNoticeDraft } from "@/lib/email-draft";
import type { HandoverItem, Drawing } from "@/lib/types";

const drawingFields: FieldDef[] = [
  { key: "title", label: "Drawing Title", required: true, colSpan: 2 },
  { key: "status", label: "Status" },
  { key: "submitted_to", label: "Submitted To" },
  { key: "notes", label: "Notes", colSpan: 2 },
];

export function HandoverManager({
  active,
  forecasted,
  drawingsByHandover,
  siteOptions,
  siteContactEmails,
  senderName,
  companyName,
  departmentName,
  editable,
  canDelete,
}: {
  active: HandoverItem[];
  forecasted: HandoverItem[];
  drawingsByHandover: Record<string, Drawing[]>;
  siteOptions: { value: string; label: string }[];
  /** Site id -> the site's point of contact, used to address the notice. */
  siteContactEmails: Record<string, string>;
  senderName: string;
  companyName: string;
  departmentName: string;
  editable: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const fields: FieldDef[] = [
    { key: "job_description", label: "Job Description", required: true, colSpan: 2 },
    { key: "qty", label: "Qty", type: "number", step: "0.01" },
    {
      key: "site_id",
      label: "Site",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...siteOptions],
    },
    { key: "po_ref", label: "PO Ref" },
    { key: "supplier", label: "Supplier" },
    { key: "expected_completion", label: "Expected Completion", type: "date" },
    { key: "remark", label: "Remark", colSpan: 2 },
  ];

  const act = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: ok });
        router.refresh();
      }
    });

  const Section = ({
    title,
    items,
    type,
    withDrawings,
  }: {
    title: string;
    items: HandoverItem[];
    type: "active" | "forecasted";
    withDrawings: boolean;
  }) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-amber">
          {title} <span className="text-muted-foreground">({items.length})</span>
        </h2>
        {editable && (
          <RecordFormDialog
            title={`New ${type === "active" ? "Active" : "Forecasted"} Item`}
            fields={fields}
            onSubmit={(v) => createHandover(type, v)}
            trigger={
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4" /> Add
              </Button>
            }
          />
        )}
      </div>

      {items.length === 0 && (
        <p className="border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
          No {type} items.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((it) => (
          <div key={it.id} className="border border-border bg-card">
            <div className="flex items-start justify-between gap-2 border-b border-border p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{it.job_description}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                  {it.qty != null && <span>Qty {it.qty}</span>}
                  {it.po_ref && <span>PO {it.po_ref}</span>}
                  {it.supplier && <span>{it.supplier}</span>}
                  {it.expected_completion && <span>ECD {fmtDate(it.expected_completion)}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Draft transfer notice">
                  <a
                    href={transferNoticeDraft({
                      to: it.site_id ? siteContactEmails[it.site_id] ?? null : null,
                      companyName,
                      departmentName,
                      senderName,
                      jobDescription: it.job_description ?? "Fabricated item",
                      qty: it.qty,
                      poRef: it.po_ref,
                      supplier: it.supplier,
                      siteLabel:
                        siteOptions.find((s) => s.value === it.site_id)?.label ?? null,
                      expectedCompletion: it.expected_completion,
                      remark: it.remark,
                    })}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </a>
                </Button>
                  {editable && (
                    <RecordFormDialog
                      title="Edit Handover Item"
                      fields={fields}
                      initial={it as unknown as Record<string, unknown>}
                      onSubmit={(v) => updateHandover(it.id, v)}
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
                      disabled={pending}
                      onClick={() => {
                        if (confirm("Delete this handover item?"))
                          act(() => deleteHandover(it.id), "Deleted");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
              </div>
            </div>
            {it.remark && (
              <p className="border-b border-border bg-secondary/40 p-2 text-xs text-muted-foreground">
                {it.remark}
              </p>
            )}
            {withDrawings && (
              <div className="p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> Drawings
                  </span>
                  {editable && (
                    <RecordFormDialog
                      title="Add Drawing"
                      fields={drawingFields}
                      onSubmit={(v) => addDrawing(it.id, v)}
                      trigger={
                        <Button variant="ghost" size="sm" className="h-6 text-xs">
                          <Plus className="h-3 w-3" /> Drawing
                        </Button>
                      }
                    />
                  )}
                </div>
                <div className="space-y-1">
                  {(drawingsByHandover[it.id] ?? []).length === 0 && (
                    <p className="text-[11px] text-muted-foreground">No drawings tracked.</p>
                  )}
                  {(drawingsByHandover[it.id] ?? []).map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-2 border-l-2 border-steel/40 pl-2 text-xs"
                    >
                      <span className="truncate">{d.title}</span>
                      <div className="flex items-center gap-2">
                        {d.status && <Badge variant="outline">{d.status}</Badge>}
                        {d.submitted_to && (
                          <span className="text-[10px] text-muted-foreground">→ {d.submitted_to}</span>
                        )}
                        {editable && (
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => act(() => deleteDrawing(d.id), "Drawing removed")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-8">
      <Section title="Active Jobs" items={active} type="active" withDrawings />
      <Section title="Forecasted Jobs" items={forecasted} type="forecasted" withDrawings={false} />
    </div>
  );
}
