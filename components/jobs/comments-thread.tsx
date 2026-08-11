"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Bell, BellOff, MessageSquare, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addComment, deleteComment } from "@/app/(app)/jobs/[id]/worksheet/actions";
import { setJobWatch } from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";
import { fmtDate } from "@/lib/date";
import type { JobComment } from "@/lib/types";

export interface Mentionable {
  id: string;
  name: string;
}

export function CommentsThread({
  jobId,
  initial,
  authorNames,
  currentUserId,
  isAdmin,
  mentionable = [],
  watching = null,
}: {
  jobId: string;
  initial: JobComment[];
  authorNames: Record<string, string>;
  currentUserId: string;
  /** Administrators may remove anyone's comment. */
  isAdmin: boolean;
  /** People who can be tagged with @. */
  mentionable?: Mentionable[];
  /** null = following by default, true/false = an explicit choice. */
  watching?: boolean | null;
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

  // "@" opens the picker; it stays open while the token after it still
  // matches a name, so typing narrows the list rather than dismissing it.
  const [pickerAt, setPickerAt] = useState<number | null>(null);
  const [pickerTerm, setPickerTerm] = useState("");

  const suggestions = pickerAt == null
    ? []
    : mentionable
        .filter((m) => m.id !== currentUserId)
        .filter((m) => m.name.toLowerCase().includes(pickerTerm.toLowerCase()))
        .slice(0, 6);

  const onBodyChange = (value: string, caret: number) => {
    setBody(value);
    const at = value.lastIndexOf("@", caret - 1);
    if (at === -1) {
      setPickerAt(null);
      return;
    }
    const between = value.slice(at + 1, caret);
    // A mention is one or two words; anything longer means they moved on.
    // Kept to ASCII word characters so the pattern needs no unicode flag.
    if (/^[\w.\-']*( [\w.\-']*)?$/.test(between)) {
      setPickerAt(at);
      setPickerTerm(between);
    } else {
      setPickerAt(null);
    }
  };

  const choose = (m: Mentionable) => {
    if (pickerAt == null) return;
    const before = body.slice(0, pickerAt);
    const after = body.slice(pickerAt + 1 + pickerTerm.length);
    setBody(`${before}@${m.name}${after.startsWith(" ") ? "" : " "}${after}`);
    setPickerAt(null);
  };

  /** Names written as @Name map back to ids at send time. */
  const resolveMentions = (text: string): string[] => {
    const ids = new Set<string>();
    for (const m of mentionable) {
      if (m.id === currentUserId) continue;
      if (text.toLowerCase().includes(`@${m.name.toLowerCase()}`)) ids.add(m.id);
    }
    return Array.from(ids);
  };

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      const res = await addComment(jobId, text, resolveMentions(text));
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
        <WatchToggle jobId={jobId} watching={watching} />
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
        <div className="relative flex-1">
          {pickerAt != null && suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 z-20 mb-1 w-64 border border-border bg-card shadow-lg">
              <p className="border-b border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Tag someone
              </p>
              {suggestions.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => choose(m)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted"
                >
                  <AtSign className="h-3 w-3 text-muted-foreground" />
                  {m.name}
                </button>
              ))}
            </div>
          )}
          <Textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            placeholder="Add a comment… type @ to tag someone"
            rows={2}
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Escape") setPickerAt(null);
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
          />
        </div>
        <Button size="sm" onClick={submit} disabled={pending || !body.trim()} type="button">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Follow or mute this job. Everyone working on a job is notified by default;
 * this is the explicit override in either direction.
 */
function WatchToggle({
  jobId,
  watching,
}: {
  jobId: string;
  watching: boolean | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [state, setState] = useState<boolean | null>(watching);
  const on = state !== false;

  return (
    <button
      type="button"
      disabled={pending}
      title={on ? "You are notified about this job" : "You have muted this job"}
      onClick={() =>
        start(async () => {
          const next = !on;
          const res = await setJobWatch(jobId, next);
          if (res.error) {
            toast({ variant: "destructive", title: "Failed", description: res.error });
            return;
          }
          setState(next);
          toast({ title: next ? "Following this job" : "Muted — you can still be tagged with @" });
          router.refresh();
        })
      }
      className="ml-auto flex items-center gap-1 text-[11px] font-normal normal-case tracking-normal text-muted-foreground hover:text-foreground"
    >
      {on ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
      {on ? "Following" : "Muted"}
    </button>
  );
}
