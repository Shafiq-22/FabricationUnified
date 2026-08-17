"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Link2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  addMdbSection,
  deleteMdb,
  deleteMdbSection,
  linkMdbDocument,
  setMdbSectionStatuses,
  unlinkMdbDocument,
  updateMdbHeader,
  updateMdbSection,
} from "@/app/(app)/jobs/[id]/mdb/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MDB_CHAPTERS, MDB_STATUSES, mdbStatusMeta } from "@/lib/mdb/template";
import { MdbDownloadButton } from "./mdb-download-button";
import type { MdbDocData } from "./mdb-document";

export interface MdbHeader {
  id: string;
  document_no: string | null;
  revision: string | null;
  project_number: string | null;
  project_name: string | null;
  customer: string | null;
  customer_project_number: string | null;
  product: string | null;
  tag_number: string | null;
  product_type: string | null;
  company_name: string | null;
  company_address: string | null;
  notes: string | null;
}

export interface MdbSection {
  id: string;
  seq_no: number;
  chapter_no: string;
  chapter_title: string;
  section_no: string;
  section_title: string;
  code: string | null;
  status: string;
  doc_reference: string | null;
  notes: string | null;
  documents: { id: string; title: string; doc_type: string | null; revision: string | null }[];
}

export interface JobDocumentOption {
  id: string;
  title: string;
  doc_type: string | null;
  revision: string | null;
}

const CELL =
  "h-8 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-steel disabled:opacity-50";

export function MdbBuilder({
  jobId,
  jobCode,
  header,
  sections,
  jobDocuments,
  editable,
  isAdmin,
}: {
  jobId: string;
  jobCode: string;
  header: MdbHeader;
  sections: MdbSection[];
  /** Documents already attached to this job, offered as evidence. */
  jobDocuments: JobDocumentOption[];
  editable: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error: string | null }>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) {
        toast({ variant: "destructive", title: "Could not save", description: res.error });
      } else {
        if (ok) toast({ title: ok });
        router.refresh();
      }
    });

  // Chapters, in the order the sections are stored.
  const chapters = useMemo(() => {
    const map = new Map<string, MdbSection[]>();
    for (const s of sections) {
      const list = map.get(s.chapter_no);
      if (list) list.push(s);
      else map.set(s.chapter_no, [s]);
    }
    return Array.from(map.entries());
  }, [sections]);

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(chapters.map(([c], i) => [c, i === 0])),
  );

  const counts = useMemo(
    () => ({
      included: sections.filter((s) => s.status === "included").length,
      pending: sections.filter((s) => s.status === "pending").length,
      na: sections.filter((s) => s.status === "not_applicable").length,
      evidence: sections.reduce((n, s) => n + s.documents.length, 0),
    }),
    [sections],
  );

  const docData: MdbDocData = {
    companyName: header.company_name,
    companyAddress: header.company_address,
    documentNo: header.document_no,
    revision: header.revision,
    projectNumber: header.project_number,
    projectName: header.project_name,
    customer: header.customer,
    customerProjectNumber: header.customer_project_number,
    product: header.product,
    tagNumber: header.tag_number,
    productType: header.product_type,
    notes: header.notes,
    jobCode,
    generatedOn: new Date().toISOString().slice(0, 10),
    sections: sections.map((s) => ({
      chapter_no: s.chapter_no,
      chapter_title: s.chapter_title,
      section_no: s.section_no,
      section_title: s.section_title,
      code: s.code,
      status: s.status,
      doc_reference: s.doc_reference,
      notes: s.notes,
      documents: s.documents.map((d) => ({
        title: d.title,
        doc_type: d.doc_type,
        revision: d.revision,
      })),
    })),
  };

  return (
    <div className="space-y-4 p-6">
      {/* Summary + export */}
      <div className="flex flex-wrap items-center gap-3 border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Stat label="Included" value={counts.included} tone="text-status-com" />
          <Stat label="Pending" value={counts.pending} tone="text-status-inp" />
          <Stat label="Not applicable" value={counts.na} tone="text-muted-foreground" />
          <Stat label="Documents linked" value={counts.evidence} tone="text-steel" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            Not-applicable sections stay in the index but get no divider page.
          </span>
          <MdbDownloadButton
            data={docData}
            filename={`${header.document_no || jobCode || "MDB"}-Rev${header.revision || "A"}`}
          />
        </div>
      </div>

      <HeaderForm
        jobId={jobId}
        header={header}
        editable={editable}
        pending={pending}
        onSave={(v) => run(() => updateMdbHeader(jobId, header.id, v), "MDB details saved")}
      />

      {/* Sections */}
      <div className="space-y-2">
        {chapters.map(([chapterNo, rows]) => {
          const isOpen = open[chapterNo] ?? false;
          const done = rows.filter((r) => r.status === "included").length;
          return (
            <div key={chapterNo} className="border border-border bg-card">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 hover:bg-muted/40">
                <button
                  type="button"
                  onClick={() => setOpen((s) => ({ ...s, [chapterNo]: !isOpen }))}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="code-chip text-steel">{chapterNo}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {rows[0]?.chapter_title ?? MDB_CHAPTERS[chapterNo]}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {done}/{rows.length} included
                  </span>
                </button>
                {editable && (
                  <div className="flex shrink-0 items-center gap-1">
                    {MDB_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        disabled={pending}
                        title={`Mark every section in this chapter "${s.label}"`}
                        onClick={() =>
                          run(
                            () =>
                              setMdbSectionStatuses(
                                jobId,
                                rows.map((r) => r.id),
                                s.value,
                              ),
                            `Chapter ${chapterNo} marked ${s.label.toLowerCase()}`,
                          )
                        }
                        className="border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isOpen && (
                <div className="border-t border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                        <th className="w-14 px-2 py-1.5 text-left font-semibold uppercase tracking-wide">No.</th>
                        <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Section</th>
                        <th className="w-20 px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Code</th>
                        <th className="w-40 px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Status</th>
                        <th className="w-48 px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Reference</th>
                        <th className="w-56 px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Documents</th>
                        {editable && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <SectionRow
                          key={s.id}
                          jobId={jobId}
                          section={s}
                          jobDocuments={jobDocuments}
                          editable={editable}
                          pending={pending}
                          run={run}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {editable && (
          <AddSectionDialog
            jobId={jobId}
            mdbId={header.id}
            pending={pending}
            onAdd={(v) => run(() => addMdbSection(jobId, header.id, v), "Section added")}
          />
        )}
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            className="ml-auto text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (
                !confirm(
                  "Delete this Manufacturing Data Book?\n\nThe sections and document links go with it. The documents themselves are not touched.",
                )
              )
                return;
              run(() => deleteMdb(jobId, header.id), "MDB deleted");
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete MDB
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="flex items-baseline gap-1.5 border border-border px-2 py-1">
      <span className={cn("text-sm font-semibold tabular", tone)}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </span>
  );
}

function SectionRow({
  jobId,
  section,
  jobDocuments,
  editable,
  pending,
  run,
}: {
  jobId: string;
  section: MdbSection;
  jobDocuments: JobDocumentOption[];
  editable: boolean;
  pending: boolean;
  run: (fn: () => Promise<{ error: string | null }>, ok?: string) => void;
}) {
  const meta = mdbStatusMeta(section.status);
  const linkedIds = new Set(section.documents.map((d) => d.id));
  const available = jobDocuments.filter((d) => !linkedIds.has(d.id));

  return (
    <tr className="border-b border-border/60 align-top">
      <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
        {section.section_no}
      </td>
      <td className="px-2 py-1.5">
        {editable ? (
          <BlurInput
            value={section.section_title}
            disabled={pending}
            onCommit={(v) => run(() => updateMdbSection(jobId, section.id, { section_title: v }))}
          />
        ) : (
          <span className="px-2">{section.section_title}</span>
        )}
        {editable ? (
          <BlurInput
            value={section.notes}
            placeholder="Note (printed on the divider)"
            disabled={pending}
            className="text-[11px] text-muted-foreground"
            onCommit={(v) => run(() => updateMdbSection(jobId, section.id, { notes: v }))}
          />
        ) : (
          section.notes && (
            <div className="px-2 text-[11px] text-muted-foreground">{section.notes}</div>
          )
        )}
      </td>
      <td className="px-2 py-1.5">
        {editable ? (
          <BlurInput
            value={section.code}
            placeholder="Tab"
            disabled={pending}
            className="font-mono"
            onCommit={(v) => run(() => updateMdbSection(jobId, section.id, { code: v }))}
          />
        ) : (
          <span className="px-2 font-mono">{section.code ?? "—"}</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        {editable ? (
          <select
            value={section.status}
            disabled={pending}
            onChange={(e) =>
              run(() => updateMdbSection(jobId, section.id, { status: e.target.value }))
            }
            className={CELL}
          >
            {MDB_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        ) : (
          <Badge variant={meta.badge}>{meta.label}</Badge>
        )}
      </td>
      <td className="px-2 py-1.5">
        {editable ? (
          <BlurInput
            value={section.doc_reference}
            placeholder="Doc. no / rev"
            disabled={pending}
            onCommit={(v) => run(() => updateMdbSection(jobId, section.id, { doc_reference: v }))}
          />
        ) : (
          <span className="px-2">{section.doc_reference ?? "—"}</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <div className="space-y-1">
          {section.documents.map((d) => (
            <div key={d.id} className="flex items-center gap-1">
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={d.title}>
                {d.title}
              </span>
              {editable && (
                <button
                  type="button"
                  disabled={pending}
                  title="Unlink"
                  onClick={() =>
                    run(() => unlinkMdbDocument(jobId, section.id, d.id))
                  }
                  className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {editable && available.length > 0 && (
            <select
              value=""
              disabled={pending}
              onChange={(e) => {
                if (!e.target.value) return;
                run(() => linkMdbDocument(jobId, section.id, e.target.value), "Document linked");
              }}
              className={cn(CELL, "text-[11px] text-muted-foreground")}
            >
              <option value="">+ Link a job document…</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          )}
          {section.documents.length === 0 && (!editable || available.length === 0) && (
            <span className="px-2 text-muted-foreground">—</span>
          )}
        </div>
      </td>
      {editable && (
        <td className="px-1 py-1.5">
          <button
            type="button"
            disabled={pending}
            title="Remove this section from the book"
            onClick={() => {
              if (!confirm(`Remove section ${section.section_no} "${section.section_title}"?`))
                return;
              run(() => deleteMdbSection(jobId, section.id), "Section removed");
            }}
            className="text-muted-foreground hover:text-destructive disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
}

/** Commits on blur or Enter — one write per edit, and no cursor jump. */
function BlurInput({
  value,
  placeholder,
  disabled,
  className,
  onCommit,
}: {
  value: string | null | undefined;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [focused, setFocused] = useState(false);
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
      className={cn(CELL, className)}
    />
  );
}

function HeaderForm({
  header,
  editable,
  pending,
  onSave,
}: {
  jobId: string;
  header: MdbHeader;
  editable: boolean;
  pending: boolean;
  onSave: (values: Record<string, string>) => void;
}) {
  const [v, setV] = useState<Record<string, string>>({
    document_no: header.document_no ?? "",
    revision: header.revision ?? "A",
    project_number: header.project_number ?? "",
    project_name: header.project_name ?? "",
    customer: header.customer ?? "",
    customer_project_number: header.customer_project_number ?? "",
    product: header.product ?? "",
    tag_number: header.tag_number ?? "",
    product_type: header.product_type ?? "",
    company_name: header.company_name ?? "",
    company_address: header.company_address ?? "",
    notes: header.notes ?? "",
  });
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cover page &amp; document details
        </h3>
        {editable && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onSave(v)}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        )}
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <F label="MDB Document No.">
          <Input value={v.document_no} disabled={!editable} onChange={(e) => set("document_no", e.target.value)} />
        </F>
        <F label="Revision">
          <Input value={v.revision} disabled={!editable} onChange={(e) => set("revision", e.target.value)} />
        </F>
        <F label="Company Name">
          <Input value={v.company_name} disabled={!editable} onChange={(e) => set("company_name", e.target.value)} />
        </F>
        <F label="Company Address">
          <Input
            value={v.company_address}
            disabled={!editable}
            placeholder="One line per row"
            onChange={(e) => set("company_address", e.target.value)}
          />
        </F>

        <F label="Project Number">
          <Input value={v.project_number} disabled={!editable} onChange={(e) => set("project_number", e.target.value)} />
        </F>
        <F label="Project Name">
          <Input value={v.project_name} disabled={!editable} onChange={(e) => set("project_name", e.target.value)} />
        </F>
        <F label="Customer">
          <Input value={v.customer} disabled={!editable} onChange={(e) => set("customer", e.target.value)} />
        </F>
        <F label="Customer Project No.">
          <Input
            value={v.customer_project_number}
            disabled={!editable}
            onChange={(e) => set("customer_project_number", e.target.value)}
          />
        </F>

        <F label="Product" className="sm:col-span-2">
          <Input value={v.product} disabled={!editable} onChange={(e) => set("product", e.target.value)} />
        </F>
        <F label="Tag Number">
          <Input value={v.tag_number} disabled={!editable} onChange={(e) => set("tag_number", e.target.value)} />
        </F>
        <F label="Type">
          <Input
            value={v.product_type}
            disabled={!editable}
            placeholder="e.g. Structural steel assembly"
            onChange={(e) => set("product_type", e.target.value)}
          />
        </F>

        <F label="Notes (printed as a final page)" className="sm:col-span-2 lg:col-span-4">
          <Textarea
            rows={2}
            value={v.notes}
            disabled={!editable}
            className="text-xs"
            onChange={(e) => set("notes", e.target.value)}
          />
        </F>
      </div>
    </div>
  );
}

function F({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function AddSectionDialog({
  pending,
  onAdd,
}: {
  jobId: string;
  mdbId: string;
  pending: boolean;
  onAdd: (values: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ chapter_no: "1", section_title: "", code: "" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" /> Add a section
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a section</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Chapter</Label>
            <select
              value={v.chapter_no}
              onChange={(e) => setV((s) => ({ ...s, chapter_no: e.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {Object.entries(MDB_CHAPTERS).map(([no, title]) => (
                <option key={no} value={no}>
                  {no} — {title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Section title *</Label>
            <Input
              value={v.section_title}
              onChange={(e) => setV((s) => ({ ...s, section_title: e.target.value }))}
              placeholder="e.g. Galvanising Certificates"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tab code</Label>
            <Input
              value={v.code}
              onChange={(e) => setV((s) => ({ ...s, code: e.target.value }))}
              placeholder="e.g. GALV"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            It is numbered as the next section in that chapter and added to the end
            of it.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={pending || !v.section_title.trim()}
            onClick={() => {
              onAdd(v);
              setV({ chapter_no: v.chapter_no, section_title: "", code: "" });
              setOpen(false);
            }}
          >
            <Link2 className="h-4 w-4" /> Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
