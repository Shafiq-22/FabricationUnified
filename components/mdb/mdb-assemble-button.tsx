"use client";

import { useState } from "react";
import { AlertTriangle, BookCheck } from "lucide-react";
import { getViewUrl } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/lib/hooks/use-toast";
import type { AssembleInput, AssembleSkip } from "./mdb-assemble";

/**
 * Builds the complete book — front matter plus every attached certificate —
 * as one PDF, in the browser. pdf-lib and the renderer are dynamically
 * imported so neither reaches the shared bundle.
 *
 * Files that cannot be merged (a .docx, an unreadable PDF) are reported
 * afterwards rather than silently dropped: an incomplete data book that looks
 * complete is worse than one that tells you what is missing.
 */
export function MdbAssembleButton({
  data,
  filename,
  disabled,
}: {
  data: AssembleInput;
  filename: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(
    null,
  );
  const [report, setReport] = useState<{
    pageCount: number;
    merged: number;
    skipped: AssembleSkip[];
  } | null>(null);

  const attachments = data.sections
    .filter((s) => s.status !== "not_applicable")
    .reduce((n, s) => n + s.sourceDocuments.length, 0);

  async function generate() {
    setBusy(true);
    setProgress({ done: 0, total: 1, label: "Starting…" });
    try {
      const { assembleMdbPdf } = await import("./mdb-assemble");
      const result = await assembleMdbPdf(
        data,
        (filePath) => getViewUrl(filePath),
        (done, total, label) => setProgress({ done, total, label }),
      );

      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (result.skipped.length > 0) {
        setReport(result);
      } else {
        toast({
          title: "Complete MDB generated",
          description: `${result.pageCount} pages · ${result.merged} document${
            result.merged === 1 ? "" : "s"
          } merged.`,
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not assemble the MDB",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <>
      <Button
        size="sm"
        onClick={generate}
        disabled={busy || disabled}
        type="button"
        title="Cover, index, dividers and every attached document in one PDF"
      >
        <BookCheck className="h-4 w-4" />
        {busy
          ? progress
            ? `${progress.done}/${progress.total} — ${progress.label}`.slice(0, 42)
            : "Assembling…"
          : "Download complete PDF"}
      </Button>
      {attachments === 0 && !busy && (
        <span className="text-[11px] text-muted-foreground">
          No documents linked yet — the PDF will be dividers only.
        </span>
      )}

      <Dialog open={report != null} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>MDB downloaded — some files could not be merged</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {report?.pageCount} pages, {report?.merged} document
            {report?.merged === 1 ? "" : "s"} merged. The {report?.skipped.length} below were left
            out and must be added by hand — only PDFs and JPEG/PNG images can be merged.
          </p>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {report?.skipped.map((sk, i) => (
              <div key={i} className="border border-amber/40 bg-amber/10 px-3 py-2 text-xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
                  <div className="min-w-0">
                    <div className="font-medium">{sk.title}</div>
                    <div className="text-muted-foreground">
                      {sk.section} — {sk.reason}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReport(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
