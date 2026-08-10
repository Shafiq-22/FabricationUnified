"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Mail } from "lucide-react";
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
import type { JobMaterial } from "@/lib/types";

export interface JobBucket {
  jobId: string | null;
  jobCode: string;
  jobDescription: string | null;
  siteCode: string | null;
  rows: JobMaterial[];
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
}: {
  buckets: ProjectBucket[];
  supplierEmails: Record<string, string>;
  senderName: string;
  companyName: string;
  departmentName: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    buckets.length > 0 ? { [buckets[0].projectCode]: true } : {},
  );

  if (buckets.length === 0)
    return (
      <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No material records match these filters.
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
}: {
  job: JobBucket;
  projectCode: string | null;
  supplierEmails: Record<string, string>;
  senderName: string;
  companyName: string;
  departmentName: string;
}) {
  const { toast } = useToast();

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
        .map((r) => r.request_date)
        .filter(Boolean)
        .sort()[0] as string | undefined,
      lines: outstanding.map((r) => ({
        item: r.item_name ?? "—",
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
            <TableHead>Qty</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>PR / LPO</TableHead>
            <TableHead>Ordered</TableHead>
            <TableHead>Delivered</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {job.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="max-w-[20rem] truncate text-xs">
                {r.item_name ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular text-xs">
                {r.qty ?? "—"} {r.unit ?? ""}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.supplier ?? "—"}
              </TableCell>
              <TableCell className="font-mono text-[11px] text-muted-foreground">
                {[r.pr_no, r.lpo_no].filter(Boolean).join(" / ") || "—"}
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {fmtDate(r.order_date)}
              </TableCell>
              <TableCell className="text-center text-xs">
                {r.delivery_date ? (
                  <Badge variant="com">{fmtDate(r.delivery_date)}</Badge>
                ) : (
                  <Badge variant="inp">Pending</Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular text-xs">
                {formatAED(r.total_price)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
