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
}: {
  jobOptions: { value: string; label: string }[];
  defaultJobId?: string;
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState(defaultJobId ?? "none");
  const [docType, setDocType] = useState<string>("drawing");
  const [title, setTitle] = useState("");
  const [revision, setRevision] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  const reset = () => {
    setFile(null);
    setJobId(defaultJobId ?? "none");
    setDocType("drawing");
    setTitle("");
    setRevision("");
    setNotes("");
    setError(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_MB} MB.`);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const path = documentObjectPath(jobId, file.name);
      const { error: upErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) {
        setError(upErr.message);
        return;
      }

      const res = await registerDocument({
        job_id: jobId,
        doc_type: docType,
        title: title || file.name,
        revision,
        notes,
        file_path: path,
        original_filename: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      });
      if (res.error) {
        setError(res.error);
        return;
      }

      // Open the file the user just uploaded so they can check it went up
      // intact. The tab is opened synchronously-ish off the click that
      // started the upload, so it is not treated as a popup.
      const view = await getViewUrl(path);
      if (view.url) window.open(view.url, "_blank", "noopener,noreferrer");

      toast({ title: "Document uploaded", description: file.name });
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
        <Button size="sm">
          <Upload className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="file" className="text-xs">
              File * <span className="text-muted-foreground">(max {MAX_MB} MB)</span>
            </Label>
            <Input
              id="file"
              type="file"
              required
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title) setTitle(f.name);
              }}
              className="text-xs file:mr-2 file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
            />
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
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
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
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
