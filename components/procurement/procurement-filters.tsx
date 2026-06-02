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
import { recentMonths } from "@/lib/date";

const ALL = "all";

export function ProcurementFilters({
  jobs,
}: {
  jobs: { value: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [supplier, setSupplier] = useState(params.get("supplier") ?? "");
  const months = recentMonths(18);

  const setParam = useCallback(
    (key: string, value: string) => {
      const sp = new URLSearchParams(params.toString());
      if (!value || value === ALL) sp.delete(key);
      else sp.set(key, value);
      router.push(`/procurement?${sp.toString()}`);
    },
    [params, router],
  );

  useEffect(() => {
    const current = params.get("supplier") ?? "";
    if (supplier === current) return;
    const t = setTimeout(() => setParam("supplier", supplier), 350);
    return () => clearTimeout(t);
  }, [supplier, params, setParam]);

  const hasFilters =
    params.get("job") || params.get("supplier") || params.get("month");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-6 py-3">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="Supplier…"
          className="h-8 w-56 pl-7 text-xs"
        />
      </div>
      <Select value={params.get("job") ?? ALL} onValueChange={(v) => setParam("job", v)}>
        <SelectTrigger className="h-8 w-[200px] text-xs">
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
      <Select value={params.get("month") ?? ALL} onValueChange={(v) => setParam("month", v)}>
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
            setSupplier("");
            router.push("/procurement");
          }}
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
