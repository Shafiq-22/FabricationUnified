"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JOB_STATUSES } from "@/lib/types";
import { recentMonths } from "@/lib/date";

const ALL = "all";

export function JobsFilterBar({
  sites,
}: {
  sites: { id: string; code: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const months = recentMonths(18);

  const setParam = useCallback(
    (key: string, value: string) => {
      const sp = new URLSearchParams(params.toString());
      if (!value || value === ALL) sp.delete(key);
      else sp.set(key, value);
      router.push(`/jobs?${sp.toString()}`);
    },
    [params, router],
  );

  // Debounce free-text search into the URL.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => setParam("q", q), 350);
    return () => clearTimeout(t);
  }, [q, params, setParam]);

  const hasFilters =
    params.get("status") || params.get("site") || params.get("month") || params.get("q");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-6 py-3">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search code or description…"
          className="h-8 w-64 pl-7 text-xs"
        />
      </div>

      <Select
        value={params.get("status") ?? ALL}
        onValueChange={(v) => setParam("status", v)}
      >
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {JOB_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("site") ?? ALL}
        onValueChange={(v) => setParam("site", v)}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Site" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All sites</SelectItem>
          {sites.map((s) => (
            <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
              {s.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("month") ?? ALL}
        onValueChange={(v) => setParam("month", v)}
      >
        <SelectTrigger className="h-8 w-[140px] font-mono text-xs">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All months</SelectItem>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value} className="font-mono text-xs">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.push("/jobs");
          }}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
