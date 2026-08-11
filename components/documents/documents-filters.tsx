"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_TYPES } from "@/lib/types";

const ALL = "all";

export function DocumentsFilters({ jobs }: { jobs: { value: string; label: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const setParam = useCallback(
    (key: string, value: string) => {
      const sp = new URLSearchParams(params.toString());
      if (!value || value === ALL) sp.delete(key);
      else sp.set(key, value);
      router.push(`/documents?${sp.toString()}`);
    },
    [params, router],
  );

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => setParam("q", q), 350);
    return () => clearTimeout(t);
  }, [q, params, setParam]);

  const hasFilters = params.get("type") || params.get("job") || params.get("q");
  const view = params.get("view") ?? "project";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-6 py-3">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, filename, notes…"
          className="h-8 w-72 pl-7 text-xs"
        />
      </div>

      <Select value={params.get("type") ?? ALL} onValueChange={(v) => setParam("type", v)}>
        <SelectTrigger className="h-8 w-[170px] text-xs">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All types</SelectItem>
          {DOC_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get("job") ?? ALL} onValueChange={(v) => setParam("job", v)}>
        <SelectTrigger className="h-8 w-[210px] text-xs">
          <SelectValue placeholder="Job" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All jobs</SelectItem>
          {jobs.map((j) => (
            <SelectItem key={j.value} value={j.value} className="font-mono text-xs">
              {j.label}
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
            const sp = new URLSearchParams();
            const v = params.get("view");
            if (v) sp.set("view", v);
            router.push(`/documents${sp.toString() ? `?${sp}` : ""}`);
          }}
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}

      {/* How the list is grouped. Filters above stay applied either way. */}
      <div className="ml-auto flex items-center gap-1">
        <span className="mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          Group by
        </span>
        {(
          [
            ["project", "Project"],
            ["job", "Job"],
            ["certificate", "Certificate"],
            ["date", "Date"],
            ["uploader", "Uploader"],
          ] as [string, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setParam("view", value)}
            className={cn(
              "border px-2 py-1 text-xs transition-colors",
              view === value
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
