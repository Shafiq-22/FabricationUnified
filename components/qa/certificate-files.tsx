"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, Paperclip, Trash2 } from "lucide-react";
import {
  getDownloadUrl,
  getViewUrl,
  deleteDocument,
} from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/lib/hooks/use-toast";
import { fmtDate } from "@/lib/date";

export interface CertFile {
  id: string;
  title: string | null;
  original_filename: string | null;
  file_path: string;
  doc_type: string | null;
  uploaded_at: string | null;
}

/**
 * The files attached to one welder certificate. These are ordinary rows in
 * `documents` — the Documents tab lists the very same rows, so a scan lives
 * in one place and is pointed at from both.
 */
export function CertificateFilesDialog({
  certificateName,
  files,
  canDelete,
}: {
  certificateName: string;
  files: CertFile[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const open = (path: string) =>
    start(async () => {
      const res = await getViewUrl(path);
      if (res.error || !res.url) {
        toast({ variant: "destructive", title: "Could not open", description: res.error ?? "No URL" });
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });

  const download = (path: string, name: string | null) =>
    start(async () => {
      const res = await getDownloadUrl(path);
      if (res.error || !res.url) {
        toast({ variant: "destructive", title: "Download failed", description: res.error ?? "No URL" });
        return;
      }
      const a = document.createElement("a");
      a.href = res.url;
      a.download = name ?? "certificate";
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
        toast({ title: "File removed" });
        router.refresh();
      }
    });

  if (files.length === 0)
    return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Paperclip className="h-3.5 w-3.5" />
          {files.length}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Files — {certificateName}</DialogTitle>
        </DialogHeader>
        <p className="text-[11px] text-muted-foreground">
          These are the same records the Documents tab shows; there is no second
          copy. Removing one here removes it there too.
        </p>
        <div className="divide-y divide-border border border-border">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{f.title ?? f.original_filename ?? "Untitled"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {fmtDate(f.uploaded_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Open in browser"
                disabled={pending}
                onClick={() => open(f.file_path)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Download"
                disabled={pending}
                onClick={() => download(f.file_path, f.original_filename)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Remove"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("Remove this file? It disappears from Documents too."))
                      remove(f.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Link
          href="/documents?view=certificate"
          className="text-xs text-primary hover:underline"
        >
          Open in Documents
        </Link>
      </DialogContent>
    </Dialog>
  );
}
