"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Mail, Trash2 } from "lucide-react";
import { deleteJobMaterial, updateProcurementLine } from "@/app/(app)/procurement/actions";
import { deleteConsumable } from "@/app/(app)/consumables/actions";
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
import { materialRequestDraft } from "@/lib/email-draft";
/** The columns the grouped view needs; both materials and consumables fit. */
export interface GroupedRow {
  id: string;
  item_name: string | null;
  dimension?: string | null;
  grade?: string | null;
  qty: number | null;
  unit: string | null;
  supplier: string | null;
  supplier_id: string | null;
  pr_no: string | null;
  lpo_no: string | null;
  order_date: string | null;
  delivery_date: string | null;
  request_date?: string | null;
  total_price: number | null;
}

/** Matches the inline cells used on the worksheet tables. */
const CELL =
  "h-7 w-full min-w-[6rem] border-0 bg-transparent px-1 text-xs outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-steel disabled:opacity-50";

/**
 * A text cell that keeps its own draft while being typed in and reports the
 * value once, on blur or Enter — one write per edit instead of one per
 * keystroke, and no cursor jump from the refresh that follows.
 */
function BlurInput({
  value,
  placeholder,
  disabled,
  onCommit,
}: {
  value: string | null | undefined;
  placeholder?: string;
  disabled?: boolean;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [focused, setFocused] = useState(false);
  // While the field is not being edited it follows the row, so a refresh or
  // an edit made elsewhere is reflected here.
  const shown = focused ? draft : (value ?? "");

  return (
    <input
      type="text"
      value={shown}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => {
        setDraft(value ?? "");
        setFocused(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (draft !== (value ?? "")) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value ?? "");
          e.currentTarget.blur();
        }
      }}
      className={CELL}
    />
  );
}

export interface JobBucket {
  jobId: string | null;
  jobCode: string;
  jobDescription: string | null;
  siteCode: string | null;
  rows: GroupedRow[];
}

export interface ProjectBucket {
  projectId: string | null;
  projectCode: string;
  projectName: string | null;
  jobs: JobBucket[];
}

export function ProcurementGrouped({
  buckets,
  supplierEmails,
  senderName,
  companyName,
  departmentName,
  emptyLabel = "No material records match these filters.",
  editable = false,
  supplierOptions = [],
  canDelete = false,
  kind = "material",
}: {
  buckets: ProjectBucket[];
  supplierEmails: Record<string, string>;
  senderName: string;
  companyName: string;
  departmentName: string;
  emptyLabel?: string;
  /** Grouped is the default view, so it carries the row actions too. */
  editable?: boolean;
  supplierOptions?: { value: string; label: string }[];
  canDelete?: boolean;
  /** Which register these rows came from — decides the delete to call. */
  kind?: "material" | "consumable";
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    buckets.length > 0 ? { [buckets[0].projectCode]: true } : {},
  );

  if (buckets.length === 0)
    return (
      <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );

  return (
    <div className="space-y-2">
      {buckets.map((p) => {
        const isOpen = open[p.projectCode] ?? false;
        const count = p.jobs.reduce((s, j) => s + j.rows.length, 0);
        return (
          <div key={p.projectCode} className="border border-border bg-card">
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40">
              <button
                type="button"
                onClick={() => setOpen((s) => ({ ...s, [p.projectCode]: !isOpen }))}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="code-chip text-steel">{p.projectCode}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{p.projectName ?? ""}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.jobs.length} job(s) · {count} line(s)
                </span>
              </button>
              {p.projectId && (
                <Link
                  href={`/projects/${p.projectId}`}
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  title="Open project"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {isOpen && (
              <div className="space-y-3 border-t border-border p-3">
                {p.jobs.map((j) => (
                  <JobPanel
                    key={j.jobId ?? `nojob-${p.projectCode}`}
                    job={j}
                    projectCode={p.projectId ? p.projectCode : null}
                    supplierEmails={supplierEmails}
                    senderName={senderName}
                    companyName={companyName}
                    departmentName={departmentName}
                    editable={editable}
                    supplierOptions={supplierOptions}
                    canDelete={canDelete}
                    kind={kind}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function JobPanel({
  job,
  projectCode,
  supplierEmails,
  senderName,
  companyName,
  departmentName,
  editable,
  supplierOptions,
  canDelete,
  kind,
}: {
  job: JobBucket;
  projectCode: string | null;
  supplierEmails: Record<string, string>;
  senderName: string;
  companyName: string;
  departmentName: string;
  editable: boolean;
  supplierOptions: { value: string; label: string }[];
  canDelete: boolean;
  kind: "material" | "consumable";
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();

  // One cell at a time: the action writes only the key it is handed, so
  // saving a PR number cannot blank the supplier next to it.
  const save = (id: string, field: string, value: string) => {
    start(async () => {
      const res = await updateProcurementLine(kind, id, { [field]: value });
      if (res.error)
        toast({ variant: "destructive", title: "Could not save", description: res.error });
      else router.refresh();
    });
  };

  const remove = (id: string, label: string) => {
    if (!confirm(`Delete "${label}" from this job?`)) return;
    start(async () => {
      const res = kind === "consumable" ? await deleteConsumable(id) : await deleteJobMaterial(id);
      if (res.error)
        toast({ variant: "destructive", title: "Could not delete", description: res.error });
      else {
        toast({ title: "Deleted", description: label });
        router.refresh();
      }
    });
  };

  // A draft asks for what has not arrived yet; delivered lines are history.
  const outstanding = useMemo(
    () => job.rows.filter((r) => !r.delivery_date),
    [job.rows],
  );

  const draftHref = useMemo(() => {
    if (outstanding.length === 0) return null;
    // Pre-address the mail only when every outstanding line points at the
    // same supplier — otherwise the user picks the recipient themselves.
    const supplierIds = Array.from(
      new Set(outstanding.map((r) => r.supplier_id).filter(Boolean) as string[]),
    );
    const to =
      supplierIds.length === 1 ? supplierEmails[supplierIds[0]] ?? null : null;

    return materialRequestDraft({
      to,
      companyName,
      departmentName,
      senderName,
      jobCode: job.jobCode,
      jobDescription: job.jobDescription,
      siteCode: job.siteCode,
      projectCode,
      requiredBy: outstanding
        .map((r) => r.request_date ?? null)
        .filter(Boolean)
        .sort()[0] as string | undefined,
      lines: outstanding.map((r) => ({
        item: r.item_name ?? "—",
        dimension: r.dimension,
        grade: r.grade,
        qty: r.qty,
        unit: r.unit,
        note: r.pr_no ? `PR ${r.pr_no}` : null,
      })),
    });
  }, [outstanding, job, projectCode, supplierEmails, senderName, companyName, departmentName]);

  const total = job.rows.reduce((s, r) => s + Number(r.total_price ?? 0), 0);

  return (
    <div className="border border-border/70">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-3 py-2">
        <span className="code-chip text-steel">{job.jobCode}</span>
        {job.jobDescription && (
          <span className="min-w-0 flex-1 truncate text-xs">{job.jobDescription}</span>
        )}
        {job.siteCode && (
          <span className="font-mono text-[11px] text-muted-foreground">{job.siteCode}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {job.rows.length} line(s) · {outstanding.length} outstanding · {formatAED(total)}
        </span>
        {job.jobId && (
          <Link
            href={`/jobs/${job.jobId}/worksheet`}
            className="text-muted-foreground hover:text-primary"
            title="Open job"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
        {draftHref ? (
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <a href={draftHref}>
              <Mail className="h-3.5 w-3.5" /> Generate draft
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            type="button"
            onClick={() =>
              toast({
                title: "Nothing outstanding",
                description: "Every material line on this job has a delivery date.",
              })
            }
          >
            <Mail className="h-3.5 w-3.5" /> Generate draft
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Dimension</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>PR / LPO</TableHead>
            <TableHead>Ordered</TableHead>
            <TableHead>Delivered</TableHead>
            <TableHead>Total</TableHead>
            {canDelete && <TableHead className="w-8" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {job.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-left max-w-[20rem] truncate text-xs">
                {r.item_name ?? "—"}
              </TableCell>
              <TableCell className="text-center text-xs">{r.dimension ?? "—"}</TableCell>
              <TableCell className="text-center font-mono text-xs">{r.grade ?? "—"}</TableCell>
              <TableCell className="text-right tabular text-xs">
                {r.qty ?? "—"} {r.unit ?? ""}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {editable ? (
                  <select
                    value={r.supplier_id ?? ""}
                    disabled={pending}
                    onChange={(e) => save(r.id, "supplier_id", e.target.value)}
                    className={CELL}
                  >
                    <option value="">— Unassigned —</option>
                    {/* A supplier that has since been deactivated still has to
                        show, or the row would silently read as unassigned. */}
                    {r.supplier_id && !supplierOptions.some((o) => o.value === r.supplier_id) && (
                      <option value={r.supplier_id}>{r.supplier ?? "(inactive supplier)"}</option>
                    )}
                    {supplierOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  (r.supplier ?? "—")
                )}
              </TableCell>
              <TableCell className="font-mono text-[11px] text-muted-foreground">
                {editable ? (
                  <div className="flex items-center gap-1">
                    <BlurInput
                      value={r.pr_no}
                      placeholder="PR"
                      disabled={pending}
                      onCommit={(v) => save(r.id, "pr_no", v)}
                    />
                    <span className="text-muted-foreground">/</span>
                    <BlurInput
                      value={r.lpo_no}
                      placeholder="LPO"
                      disabled={pending}
                      onCommit={(v) => save(r.id, "lpo_no", v)}
                    />
                  </div>
                ) : (
                  [r.pr_no, r.lpo_no].filter(Boolean).join(" / ") || "—"
                )}
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {editable ? (
                  <input
                    type="date"
                    value={r.order_date ?? ""}
                    disabled={pending}
                    onChange={(e) => save(r.id, "order_date", e.target.value)}
                    className={CELL}
                  />
                ) : (
                  fmtDate(r.order_date)
                )}
              </TableCell>
              <TableCell className="text-center text-xs">
                {editable ? (
                  <input
                    type="date"
                    value={r.delivery_date ?? ""}
                    disabled={pending}
                    onChange={(e) => save(r.id, "delivery_date", e.target.value)}
                    className={CELL}
                  />
                ) : r.delivery_date ? (
                  <Badge variant="com">{fmtDate(r.delivery_date)}</Badge>
                ) : (
                  <Badge variant="inp">Pending</Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular text-xs">
                {formatAED(r.total_price)}
              </TableCell>
              {canDelete && (
                <TableCell className="px-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(r.id, r.item_name ?? "this line")}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                    title="Delete line"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
