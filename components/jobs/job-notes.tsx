"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";
import { fmtDate } from "@/lib/date";
import {
  addJobNote,
  updateJobNote,
  deleteJobNote,
} from "@/app/(app)/jobs/[id]/notes-actions";

export interface JobNote {
  id: string;
  seq_no: number;
  body: string;
  created_by: string | null;
  created_at: string;
}

/**
 * Notes against a job: dated, numbered, collapsible.
 *
 * Lives on the job page rather than among the worksheet tabs on purpose —
 * the worksheet is money-gated and invisible to tier 2, but notes are
 * operational and everyone needs them.
 */
export function JobNotes({
  jobId,
  notes,
  authorNames,
  currentUserId,
  isAdmin,
  editable,
}: {
  jobId: string;
  notes: JobNote[];
  authorNames: Record<string, string>;
  currentUserId: string;
  isAdmin: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error: string | null }>, ok: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.error) {
        toast({ variant: "destructive", title: "Failed", description: res.error });
      } else {
        toast({ title: ok });
        after?.();
        router.refresh();
      }
    });

  const mayChange = (n: JobNote) => isAdmin || n.created_by === currentUserId;

  return (
    <section className="border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-2 hover:bg-muted/40">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notes <span className="text-muted-foreground/60">({notes.length})</span>
          </h3>
          {!open && notes.length > 0 && (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/70">
              #{notes[0].seq_no} · {notes[0].body}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border p-4">
          {editable && (
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a note against this job…"
                rows={3}
                className="text-xs"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="h-7"
                  disabled={!draft.trim() || pending}
                  onClick={() =>
                    run(() => addJobNote(jobId, draft), "Note added", () => setDraft(""))
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Add note"}
                </Button>
              </div>
            </div>
          )}

          {notes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No notes on this job yet.
            </p>
          ) : (
            <ol className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="border border-border/70 bg-background/40 p-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="code-chip text-steel">#{n.seq_no}</span>
                    <span>{fmtDate(n.created_at)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {authorNames[n.created_by ?? ""] ?? "Unknown"}
                    </span>
                    {editable && mayChange(n) && editingId !== n.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditBody(n.body);
                          }}
                          className="text-muted-foreground hover:text-primary"
                          title="Edit note"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (confirm(`Delete note #${n.seq_no}? The number is not reused.`))
                              run(() => deleteJobNote(jobId, n.id), "Note deleted");
                          }}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {editingId === n.id ? (
                    <div className="mt-1 space-y-2">
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={3}
                        className="text-xs"
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7"
                          disabled={!editBody.trim() || pending}
                          onClick={() =>
                            run(() => updateJobNote(jobId, n.id, editBody), "Note updated", () =>
                              setEditingId(null),
                            )
                          }
                        >
                          <Check className="h-3.5 w-3.5" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-xs">{n.body}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
