"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addComment, deleteComment } from "@/app/(app)/jobs/[id]/worksheet/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";
import { fmtDate } from "@/lib/date";
import type { JobComment } from "@/lib/types";

export function CommentsThread({
  jobId,
  initial,
  authorNames,
  currentUserId,
  isAdmin,
}: {
  jobId: string;
  initial: JobComment[];
  authorNames: Record<string, string>;
  currentUserId: string;
  /** Administrators may remove anyone's comment. */
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const [comments, setComments] = useState<JobComment[]>(initial);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  // Realtime: append new comments as they are inserted by any user.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`job-comments-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_comments",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          const next = payload.new as JobComment;
          setComments((prev) =>
            prev.some((c) => c.id === next.id) ? prev : [...prev, next],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "job_comments",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          const gone = payload.old as { id?: string };
          if (gone?.id) setComments((prev) => prev.filter((c) => c.id !== gone.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteComment(jobId, id);
      if (res.error) {
        toast({ variant: "destructive", title: "Failed", description: res.error });
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== id));
    });

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      const res = await addComment(jobId, text);
      if (res.error) {
        toast({ variant: "destructive", title: "Failed", description: res.error });
      } else {
        setBody("");
      }
    });
  };

  return (
    <div className="border border-border bg-card">
      <h3 className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-4 w-4" /> Comments
        <span className="text-muted-foreground/60">({comments.length})</span>
      </h3>
      <div className="max-h-72 space-y-3 overflow-y-auto p-4">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="border-l-2 border-border pl-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-steel">
                {(c.user_id && authorNames[c.user_id]) || "User"}
              </span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {fmtDate(c.created_at)}
                </span>
                {(c.user_id === currentUserId || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                    title="Delete comment"
                    disabled={pending}
                    onClick={() => {
                      if (confirm("Delete this comment?")) remove(c.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="text-sm"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />
        <Button size="sm" onClick={submit} disabled={pending || !body.trim()} type="button">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
