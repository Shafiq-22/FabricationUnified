"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, Trash2, FileText } from "lucide-react";
import {
  getDownloadUrl,
  updateDocument,
  deleteDocument,
} from "@/app/(app)/documents/actions";
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
import { fmtDate } from "@/lib/date";
import { DOC_TYPES, type DocumentRow } from "@/lib/types";

function prettySize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsTable({
  rows,
  jobCodes,
  jobOptions,
  uploaderNames,
  canEdit,
  canDelete,
  compact = false,
}: {
  rows: DocumentRow[];
  jobCodes: Record<string, string>;
  jobOptions: { value: string; label: string }[];
  uploaderNames: Record<string, string>;
  canEdit: boolean;
  canDelete: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const download = (path: string, filename: string | null) =>
    start(async () => {
      const res = await getDownloadUrl(path);
      if (res.error || !res.url) {
        toast({ variant: "destructive", title: "Download failed", description: res.error ?? "No URL" });
        return;
      }
      const a = document.createElement("a");
      a.href = res.url;
      a.download = filename ?? "document";
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteDocument(id);
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: "Document deleted" });
        router.refresh();
      }
    });

  const editFields: FieldDef[] = [
    {
      key: "doc_type",
      label: "Type",
      type: "select",
      options: DOC_TYPES.map((t) => ({ value: t.value, label: t.label })),
      required: true,
    },
    { key: "revision", label: "Revision" },
    { key: "title", label: "Title", colSpan: 2 },
    {
      key: "job_id",
      label: "Job",
      type: "select",
      options: [{ value: "none", label: "— Not job-specific —" }, ...jobOptions],
      colSpan: 2,
    },
    { key: "notes", label: "Notes", colSpan: 2 },
  ];

  return (
    <div className="border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Rev</TableHead>
            {!compact && <TableHead>Job</TableHead>}
            <TableHead>Size</TableHead>
            <TableHead>Uploaded</TableHead>
            {!compact && <TableHead>By</TableHead>}
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={compact ? 6 : 8}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No documents yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="max-w-[22rem] truncate text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {d.title ?? d.original_filename ?? "Untitled"}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type}
                </Badge>
              </TableCell>
              <TableCell className="code-chip">{d.revision ?? "—"}</TableCell>
              {!compact && (
                <TableCell className="font-mono text-xs text-steel">
                  {d.job_id ? jobCodes[d.job_id] ?? "—" : "—"}
                </TableCell>
              )}
              <TableCell className="tabular text-xs text-muted-foreground">
                {prettySize(d.size_bytes)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(d.uploaded_at)}
              </TableCell>
              {!compact && (
                <TableCell className="text-xs text-muted-foreground">
                  {(d.uploaded_by && uploaderNames[d.uploaded_by]) ?? "—"}
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Download"
                    disabled={pending}
                    onClick={() => download(d.file_path, d.original_filename)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canEdit && (
                    <RecordFormDialog
                      title="Edit Document"
                      fields={editFields}
                      initial={d as unknown as Record<string, unknown>}
                      onSubmit={(v) => updateDocument(d.id, v)}
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
                        if (confirm("Delete this document?")) remove(d.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
