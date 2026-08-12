"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchBox({
  initial = "",
  autoFocus = false,
  className,
  compact = false,
}: {
  initial?: string;
  autoFocus?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term.length >= 2) router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <form onSubmit={submit} className={cn("relative", className)}>
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder={compact ? "Search…" : "Search jobs, projects, people, equipment, documents, stock…"}
        aria-label="Search"
        className={cn("pl-8", compact ? "h-8 w-56 text-xs" : "h-10")}
      />
    </form>
  );
}
