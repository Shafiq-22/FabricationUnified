"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, FolderOpen } from "lucide-react";
import { DocumentsTable } from "@/components/documents/documents-table";
import type { DocumentRow } from "@/lib/types";

export interface DocGroup {
  key: string;
  label: string;
  sublabel: string | null;
  href: string | null;
  docs: DocumentRow[];
  /** Jobs inside a project group; rendered as a second level. */
  children?: DocGroup[];
}

export function DocumentsGrouped({
  groups,
  jobCodes,
  jobOptions,
  uploaderNames,
  canEdit,
  canDelete,
}: {
  groups: DocGroup[];
  jobCodes: Record<string, string>;
  jobOptions: { value: string; label: string }[];
  uploaderNames: Record<string, string>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  // The first group starts open so the page is never a wall of closed rows.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    groups.length > 0 ? { [groups[0].key]: true } : {},
  );

  if (groups.length === 0)
    return (
      <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No documents match these filters.
      </p>
    );

  const toggle = (key: string) => setOpen((s) => ({ ...s, [key]: !s[key] }));

  const table = (docs: DocumentRow[]) => (
    <DocumentsTable
      rows={docs}
      jobCodes={jobCodes}
      jobOptions={jobOptions}
      uploaderNames={uploaderNames}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const isOpen = open[g.key] ?? false;
        const total = g.docs.length + (g.children ?? []).reduce((s, c) => s + c.docs.length, 0);
        return (
          <div key={g.key} className="border border-border bg-card">
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40">
              <button
                type="button"
                onClick={() => toggle(g.key)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{g.label}</span>
                {g.sublabel && (
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                    {g.sublabel}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {total} doc{total === 1 ? "" : "s"}
                </span>
              </button>
              {g.href && (
                <Link
                  href={g.href}
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  title="Open"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {isOpen && (
              <div className="border-t border-border p-3">
                {g.docs.length > 0 && table(g.docs)}
                {(g.children ?? []).map((c) => (
                  <div key={c.key} className="mt-3 border-l-2 border-border pl-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="code-chip text-steel">{c.label}</span>
                      {c.sublabel && (
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          {c.sublabel}
                        </span>
                      )}
                      {c.href && (
                        <Link
                          href={c.href}
                          className="text-muted-foreground hover:text-primary"
                          title="Open job"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {c.docs.length}
                      </span>
                    </div>
                    {table(c.docs)}
                  </div>
                ))}
                {total === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Nothing here yet.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
