import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/search/search-box";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface Hit {
  kind: string;
  id: string;
  title: string | null;
  subtitle: string | null;
  meta: string | null;
  href: string | null;
}

const KIND_BADGE: Record<string, "qtn" | "inp" | "com" | "del" | "hal" | "secondary"> = {
  Job: "inp",
  Project: "del",
  Client: "secondary",
  Document: "qtn",
  Stock: "com",
  Supplier: "secondary",
  NCR: "hal",
  Comment: "secondary",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await getProfile();
  const q = (searchParams.q ?? "").trim();
  let hits: Hit[] = [];
  let error: string | null = null;

  if (q.length >= 2) {
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("global_search", { p_q: q, p_limit: 100 });
    if (err) error = err.message;
    else hits = (data ?? []) as unknown as Hit[];
  }

  // Group results by kind, preserving a stable display order.
  const order = ["Job", "Project", "Client", "Document", "Stock", "Supplier", "NCR", "Comment"];
  const grouped = order
    .map((k) => ({ kind: k, rows: hits.filter((h) => h.kind === k) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div>
      <PageHeader
        title="Search"
        description={q ? `${hits.length} result(s) for “${q}”` : "Search across the whole job book"}
      />

      <div className="border-b border-border bg-card px-6 py-4">
        <SearchBox initial={q} autoFocus className="max-w-2xl" />
      </div>

      <div className="space-y-6 p-6">
        {error && (
          <p className="border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {q.length > 0 && q.length < 2 && (
          <p className="text-sm text-muted-foreground">Type at least two characters.</p>
        )}

        {q.length >= 2 && grouped.length === 0 && !error && (
          <div className="flex flex-col items-center gap-2 border border-dashed border-border bg-card py-16 text-muted-foreground">
            <SearchIcon className="h-6 w-6" />
            <p className="text-sm">No matches for “{q}”.</p>
          </div>
        )}

        {grouped.map((g) => (
          <section key={g.kind} className="border border-border bg-card">
            <h2 className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.kind}
              <span className="text-muted-foreground/60">({g.rows.length})</span>
            </h2>
            <ul className="divide-y divide-border">
              {g.rows.map((h) => (
                <li key={`${h.kind}-${h.id}`}>
                  <Link
                    href={h.href ?? "#"}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{h.title}</div>
                      {h.subtitle && (
                        <div className="truncate text-xs text-muted-foreground">{h.subtitle}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {h.meta && (
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">
                          {h.meta}
                        </span>
                      )}
                      <Badge variant={KIND_BADGE[h.kind] ?? "secondary"}>{h.kind}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
