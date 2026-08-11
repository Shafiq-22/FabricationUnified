"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, Bell, Check, MessageSquare, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  markRead,
  markAllRead,
  dismissNotification,
} from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NotificationRow {
  id: string;
  kind: string;
  job_id: string | null;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell({
  initial,
  userId,
}: {
  initial: NotificationRow[];
  userId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>(initial);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  const unread = items.filter((n) => !n.read_at).length;

  // New notifications arrive without a page load. RLS limits the stream to
  // this user's own rows, and the filter keeps the payload small.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as NotificationRow;
          setItems((prev) =>
            prev.some((n) => n.id === next.id) ? prev : [next, ...prev].slice(0, 30),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Clicking outside closes the panel.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const readOne = (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    start(async () => {
      await markRead(id);
    });
  };

  const readAll = () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    start(async () => {
      await markAllRead();
      router.refresh();
    });
  };

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    start(async () => {
      await dismissNotification(id);
    });
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        title={unread > 0 ? `${unread} unread` : "Notifications"}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-96 border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notifications
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={readAll}
                className="text-[11px] text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Nothing yet. You are notified when someone comments on a job you
                are working on, or mentions you with @.
              </p>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-2 border-b border-border/60 px-3 py-2 last:border-b-0",
                  !n.read_at && "bg-primary/5",
                )}
              >
                {n.kind === "mention" ? (
                  <AtSign className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                ) : (
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={n.href ?? "#"}
                    onClick={() => {
                      readOne(n.id);
                      setOpen(false);
                    }}
                    className="block text-xs font-medium hover:underline"
                  >
                    {n.title}
                  </Link>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {n.body}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {ago(n.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {!n.read_at && (
                    <button
                      type="button"
                      title="Mark read"
                      onClick={() => readOne(n.id)}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Dismiss"
                    onClick={() => dismiss(n.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
