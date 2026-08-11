"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registerDocument, getViewUrl } from "@/app/(app)/documents/actions";
import { DOCUMENTS_BUCKET, documentObjectPath } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";
import { DOC_TYPES } from "@/lib/types";

const MAX_MB = 50;

export function DocumentUpload({
  jobOptions,
  defaultJobId,
  label = "Upload Document",
  certificateId,
  defaultDocType = "drawing",
  triggerVariant,
  triggerClassName,
  icon,
}: {
  jobOptions: { value: string; label: string }[];
  defaultJobId?: string;
  label?: string;
  /** Attach the upload to a welder certificate instead of a job. */
  certificateId?: string;
  defaultDocType?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  triggerClassName?: string;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState(defaultJobId ?? "none");
  const [docType, setDocType] = useState<string>(defaultDocType);
  const [title, setTitle] = useState("");
  const [revision, setRevision] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  const reset = () => {
    setFiles([]);
    setJobId(defaultJobId ?? "none");
    setDocType(defaultDocType);
    setTitle("");
    setRevision("");
    setNotes("");
    setError(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.length === 0) {
      setError("Choose at least one file to upload.");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name} is larger than ${MAX_MB} MB.`);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const uploaded: string[] = [];
      const failures: string[] = [];

      // Each file is registered on its own, so one bad file does not lose
      // the rest. The title is only applied when a single file is chosen —
      // several files keep their own names.
      for (const file of files) {
        const path = documentObjectPath(jobId, file.name);
        const { error: upErr } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) {
          failures.push(`${file.name}: ${upErr.message}`);
          continue;
        }
        const res = await registerDocument({
          job_id: jobId,
          welder_certificate_id: certificateId,
          doc_type: docType,
          title: files.length === 1 ? title || file.name : file.name,
          revision,
          notes,
          file_path: path,
          original_filename: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
        });
        if (res.error) failures.push(`${file.name}: ${res.error}`);
        else uploaded.push(path);
      }

      if (uploaded.length === 0) {
        setError(failures.join("; ") || "Upload failed.");
        return;
      }
      if (failures.length > 0) {
        toast({
          variant: "destructive",
          title: `${failures.length} file(s) failed`,
          description: failures.join("; "),
        });
      }

      // Open a single upload so the user can check it went up intact.
      // Several at once would be caught by the popup blocker.
      if (uploaded.length === 1) {
        const view = await getViewUrl(uploaded[0]);
        if (view.url) window.open(view.url, "_blank", "noopener,noreferrer");
      }

      toast({
        title: uploaded.length === 1 ? "Document uploaded" : `${uploaded.length} documents uploaded`,
        description: uploaded.length === 1 ? files[0].name : undefined,
      });
      setOpen(false);
      reset();
      start(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant={triggerVariant} className={triggerClassName}>
          {icon ?? <Upload className="h-4 w-4" />} {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="file" className="text-xs">
              Files * <span className="text-muted-foreground">(max {MAX_MB} MB each)</span>
            </Label>
            <Input
              id="file"
              type="file"
              multiple
              required
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles(picked);
                if (picked.length === 1 && !title) setTitle(picked[0].name);
              }}
              className="text-xs file:mr-2 file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
            />
            {files.length > 1 && (
              <p className="text-[11px] text-muted-foreground">
                {files.length} files selected — each keeps its own filename as its
                title, and the type, revision and notes below apply to all of them.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Revision</Label>
              <Input value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="A / B / C" />
            </div>
            {!certificateId && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Job</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not job-specific —</SelectItem>
                  {jobOptions.map((j) => (
                    <SelectItem key={j.value} value={j.value}>
                      {j.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
            {files.length <= 1 && (
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-xs" />
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Uploading…" : files.length > 1 ? `Upload ${files.length} files` : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
