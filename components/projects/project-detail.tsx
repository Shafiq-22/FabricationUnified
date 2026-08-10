"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Link2, Search, Users } from "lucide-react";
import { setProjectJobs } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";
import { cn, formatAED } from "@/lib/utils";
import { fmtDate } from "@/lib/date";
import { contactRoleLabel, statusMeta } from "@/lib/types";

export interface RollupRow {
  name: string;
  detail: string | null;
  quoteQty: number;
  quoteCost: number;
  actualQty: number;
  actualCost: number;
  jobs: string[];
}

export interface ProjectJob {
  id: string;
  job_code: string | null;
  description: string | null;
  site_code: string | null;
  status: string | null;
  qty: number | null;
  unit: string | null;
  final_quote: number | null;
  actual_cost: number | null;
  profit_loss: number | null;
  completion_date: string | null;
}

type Tab = "jobs" | "materials" | "consumables" | "workforce" | "people" | "documents";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function ProjectDetail({
  projectId,
  jobs,
  availableJobs,
  materials,
  consumables,
  workforce,
  documents,
  contacts,
  meta,
  showMoney,
  canEdit,
}: {
  projectId: string;
  jobs: ProjectJob[];
  availableJobs: any[];
  materials: RollupRow[];
  consumables: RollupRow[];
  workforce: RollupRow[];
  documents: any[];
  contacts: any[];
  meta: {
    client: string;
    site: string;
    start: string;
    target: string;
    actual: string;
    notes: string;
  };
  showMoney: boolean;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<Tab>("jobs");

  const counts: Record<Tab, number> = {
    jobs: jobs.length,
    materials: materials.length,
    consumables: consumables.length,
    workforce: workforce.length,
    people: contacts.length,
    documents: documents.length,
  };

  return (
    <div className="p-6 pt-4">
      <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 border border-border bg-card p-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <Meta label="Client" value={meta.client} />
        <Meta label="Site" value={meta.site} />
        <Meta label="Start" value={meta.start} />
        <Meta label="Target" value={meta.target} />
        <Meta label="Completed" value={meta.actual} />
        <Meta label="Notes" value={meta.notes || "—"} />
      </dl>

      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {(
          [
            ["jobs", "Jobs"],
            ["materials", "Material"],
            ["consumables", "Consumables"],
            ["workforce", "Workforce"],
            ["people", "People"],
            ["documents", "Documents"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
              tab === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="ml-1.5 text-muted-foreground">{counts[value]}</span>
          </button>
        ))}
        {canEdit && tab === "jobs" && (
          <div className="ml-auto pb-1">
            <AttachJobsDialog
              projectId={projectId}
              current={jobs}
              available={availableJobs}
            />
          </div>
        )}
      </div>

      <div className="mt-3">
        {tab === "jobs" && <JobsTable jobs={jobs} showMoney={showMoney} />}
        {tab === "materials" && (
          <RollupTable rows={materials} showMoney={showMoney} unitLabel="Qty" />
        )}
        {tab === "consumables" && (
          <RollupTable rows={consumables} showMoney={showMoney} unitLabel="Qty" />
        )}
        {tab === "workforce" && (
          <RollupTable rows={workforce} showMoney={showMoney} unitLabel="Hours" />
        )}
        {tab === "people" && <PeopleList contacts={contacts} />}
        {tab === "documents" && <DocumentsList documents={documents} jobs={jobs} />}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate" title={value}>
        {value}
      </dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-border bg-card p-8 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

function JobsTable({ jobs, showMoney }: { jobs: ProjectJob[]; showMoney: boolean }) {
  if (jobs.length === 0)
    return <Empty>No jobs attached yet. Use “Attach jobs” to add them.</Empty>;

  const total = (pick: (j: ProjectJob) => number | null) =>
    jobs.reduce((s, j) => s + Number(pick(j) ?? 0), 0);

  return (
    <div className="border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Job Code</TableHead>
            <TableHead className="text-center">Description</TableHead>
            <TableHead className="text-center">Site</TableHead>
            <TableHead className="text-center">Qty</TableHead>
            <TableHead className="text-center">Status</TableHead>
            {showMoney && <TableHead className="text-center">Quote</TableHead>}
            {showMoney && <TableHead className="text-center">Actual</TableHead>}
            {showMoney && <TableHead className="text-center">P/L</TableHead>}
            <TableHead className="text-center">Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => (
            <TableRow key={j.id}>
              <TableCell>
                <Link
                  href={`/jobs/${j.id}/worksheet`}
                  className="code-chip text-steel hover:underline"
                >
                  {j.job_code}
                </Link>
              </TableCell>
              <TableCell className="max-w-[22rem] truncate text-xs">
                {j.description ?? "—"}
              </TableCell>
              <TableCell className="text-center font-mono text-xs">
                {j.site_code ?? "—"}
              </TableCell>
              <TableCell className="text-center tabular text-xs">
                {j.qty ?? "—"} {j.unit ?? ""}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={statusMeta(j.status).badge}>
                  {statusMeta(j.status).label}
                </Badge>
              </TableCell>
              {showMoney && (
                <TableCell className="text-right tabular text-xs">
                  {formatAED(j.final_quote)}
                </TableCell>
              )}
              {showMoney && (
                <TableCell className="text-right tabular text-xs">
                  {formatAED(j.actual_cost)}
                </TableCell>
              )}
              {showMoney && (
                <TableCell
                  className={cn(
                    "text-right tabular text-xs",
                    (j.profit_loss ?? 0) < 0 && "text-destructive",
                  )}
                >
                  {formatAED(j.profit_loss)}
                </TableCell>
              )}
              <TableCell className="text-center text-xs text-muted-foreground">
                {fmtDate(j.completion_date)}
              </TableCell>
            </TableRow>
          ))}
          {showMoney && (
            <TableRow className="border-t-2 border-border font-semibold">
              <TableCell colSpan={5} className="text-right text-xs uppercase tracking-wide">
                Project total
              </TableCell>
              <TableCell className="text-right tabular text-xs">
                {formatAED(total((j) => j.final_quote))}
              </TableCell>
              <TableCell className="text-right tabular text-xs">
                {formatAED(total((j) => j.actual_cost))}
              </TableCell>
              <TableCell className="text-right tabular text-xs">
                {formatAED(total((j) => j.profit_loss))}
              </TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RollupTable({
  rows,
  showMoney,
  unitLabel,
}: {
  rows: RollupRow[];
  showMoney: boolean;
  unitLabel: string;
}) {
  if (rows.length === 0)
    return <Empty>Nothing recorded on the worksheets of this project&apos;s jobs yet.</Empty>;

  const n = (v: number) => (v ? v.toLocaleString("en-AE", { maximumFractionDigits: 2 }) : "—");

  return (
    <div className="border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Item</TableHead>
            <TableHead className="text-center">Detail</TableHead>
            <TableHead className="text-center">Quoted {unitLabel}</TableHead>
            {showMoney && <TableHead className="text-center">Quoted Cost</TableHead>}
            <TableHead className="text-center">Actual {unitLabel}</TableHead>
            {showMoney && <TableHead className="text-center">Actual Cost</TableHead>}
            <TableHead className="text-center">Jobs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name}>
              <TableCell className="text-xs font-medium">{r.name}</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {r.detail ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular text-xs">{n(r.quoteQty)}</TableCell>
              {showMoney && (
                <TableCell className="text-right tabular text-xs">
                  {formatAED(r.quoteCost)}
                </TableCell>
              )}
              <TableCell className="text-right tabular text-xs">{n(r.actualQty)}</TableCell>
              {showMoney && (
                <TableCell className="text-right tabular text-xs">
                  {formatAED(r.actualCost)}
                </TableCell>
              )}
              <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                {r.jobs.join(", ")}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 border-border font-semibold">
            <TableCell colSpan={2} className="text-right text-xs uppercase tracking-wide">
              Total
            </TableCell>
            <TableCell className="text-right tabular text-xs">
              {n(rows.reduce((s, r) => s + r.quoteQty, 0))}
            </TableCell>
            {showMoney && (
              <TableCell className="text-right tabular text-xs">
                {formatAED(rows.reduce((s, r) => s + r.quoteCost, 0))}
              </TableCell>
            )}
            <TableCell className="text-right tabular text-xs">
              {n(rows.reduce((s, r) => s + r.actualQty, 0))}
            </TableCell>
            {showMoney && (
              <TableCell className="text-right tabular text-xs">
                {formatAED(rows.reduce((s, r) => s + r.actualCost, 0))}
              </TableCell>
            )}
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function PeopleList({ contacts }: { contacts: any[] }) {
  if (contacts.length === 0)
    return (
      <Empty>
        Nobody assigned yet — add them from the{" "}
        <Link href="/contacts?tab=project" className="text-primary hover:underline">
          Point of Contact
        </Link>{" "}
        tab.
      </Empty>
    );
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {contacts.map((a) => (
        <div key={a.id} className="border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {a.contact?.name ?? "(deleted contact)"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {contactRoleLabel(a.role)}
            {a.contact?.organisation ? ` · ${a.contact.organisation}` : ""}
          </p>
          {a.contact?.email && (
            <a
              href={`mailto:${a.contact.email}`}
              className="text-xs text-primary hover:underline"
            >
              {a.contact.email}
            </a>
          )}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {a.jobCode ? `via ${a.jobCode}` : "project level"}
          </p>
        </div>
      ))}
    </div>
  );
}

function DocumentsList({ documents, jobs }: { documents: any[]; jobs: ProjectJob[] }) {
  const codes: Record<string, string> = Object.fromEntries(
    jobs.map((j) => [j.id, j.job_code ?? ""]),
  );
  if (documents.length === 0)
    return (
      <Empty>
        No documents on this project.{" "}
        <Link href="/documents?view=project" className="text-primary hover:underline">
          Upload one
        </Link>{" "}
        against any of its jobs and it appears here automatically.
      </Empty>
    );
  return (
    <div className="border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Title</TableHead>
            <TableHead className="text-center">Type</TableHead>
            <TableHead className="text-center">Job</TableHead>
            <TableHead className="text-center">Uploaded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="text-xs">
                <Link
                  href={d.job_id ? `/documents?job=${d.job_id}` : "/documents?view=project"}
                  className="flex items-center gap-1.5 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {d.title}
                </Link>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {String(d.doc_type ?? "").replace(/_/g, " ")}
              </TableCell>
              <TableCell className="text-center font-mono text-[11px]">
                {d.job_id ? (codes[d.job_id] ?? "—") : "project level"}
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {fmtDate(d.uploaded_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AttachJobsDialog({
  projectId,
  current,
  available,
}: {
  projectId: string;
  current: ProjectJob[];
  available: any[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(current.map((j) => j.id)),
  );

  // Jobs already on this project stay listed so they can be detached.
  const all = useMemo(
    () => [
      ...current.map((j) => ({
        id: j.id,
        job_code: j.job_code,
        description: j.description,
        site_code: j.site_code,
        status: j.status,
      })),
      ...available,
    ],
    [current, available],
  );

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((j) =>
      [j.job_code, j.description, j.site_code].some((f) =>
        (f ?? "").toLowerCase().includes(term),
      ),
    );
  }, [all, q]);

  const save = () =>
    start(async () => {
      const res = await setProjectJobs(projectId, Array.from(picked));
      if (res.error) {
        toast({ variant: "destructive", title: "Failed", description: res.error });
        return;
      }
      setOpen(false);
      toast({ title: "Jobs updated" });
      router.refresh();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setPicked(new Set(current.map((j) => j.id)));
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Link2 className="h-3.5 w-3.5" /> Attach jobs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Jobs in this project</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search jobs…"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="max-h-80 overflow-y-auto border border-border">
          {visible.map((j) => (
            <label
              key={j.id}
              className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/50"
            >
              <Checkbox
                checked={picked.has(j.id)}
                onCheckedChange={() =>
                  setPicked((s) => {
                    const next = new Set(s);
                    if (next.has(j.id)) next.delete(j.id);
                    else next.add(j.id);
                    return next;
                  })
                }
              />
              <span className="code-chip text-steel">{j.job_code}</span>
              <span className="min-w-0 flex-1 truncate text-xs">{j.description ?? "—"}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {j.site_code ?? "—"}
              </span>
            </label>
          ))}
          {visible.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">
              No jobs match that search.
            </p>
          )}
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {picked.size} selected
          </span>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
