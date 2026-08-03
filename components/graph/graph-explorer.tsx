"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  NODE_COLOURS,
  NODE_LABELS,
  type GraphData,
  type GraphNode,
  type GraphNodeType,
} from "@/lib/graph";

export function GraphExplorer({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<{ destroy: () => void } | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hidden, setHidden] = useState<Set<GraphNodeType>>(new Set());

  // Types actually present, so the legend only offers meaningful filters.
  const presentTypes = useMemo(() => {
    const s = new Set<GraphNodeType>();
    data.nodes.forEach((n) => s.add(n.type));
    return Array.from(s);
  }, [data.nodes]);

  const visible = useMemo(() => {
    const nodes = data.nodes.filter((n) => !hidden.has(n.type));
    const ids = new Set(nodes.map((n) => n.id));
    return {
      nodes,
      edges: data.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    };
  }, [data, hidden]);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    (async () => {
      // Loaded on demand so cytoscape stays out of the main bundle.
      const cytoscape = (await import("cytoscape")).default;
      if (cancelled || !containerRef.current) return;

      cyRef.current?.destroy();
      const cy = cytoscape({
        container: containerRef.current,
        elements: [
          ...visible.nodes.map((n) => ({ data: { ...n } })),
          ...visible.edges.map((e) => ({
            data: { id: `${e.source}->${e.target}`, ...e },
          })),
        ],
        style: [
          {
            selector: "node",
            style: {
              "background-color": (n: { data: (k: string) => string }) =>
                NODE_COLOURS[n.data("type") as GraphNodeType] ?? "#888",
              label: "data(label)",
              "font-size": 9,
              color: "#0E2841",
              "text-valign": "bottom",
              "text-margin-y": 4,
              "text-max-width": "110px",
              "text-wrap": "ellipsis",
              width: 22,
              height: 22,
              "border-width": 1,
              "border-color": "#ffffff",
            },
          },
          {
            selector: "node:selected",
            style: { "border-width": 3, "border-color": "#E97132", width: 28, height: 28 },
          },
          {
            selector: "edge",
            style: {
              width: 1,
              "line-color": "#c9d2dd",
              "target-arrow-color": "#c9d2dd",
              "target-arrow-shape": "triangle",
              "arrow-scale": 0.7,
              "curve-style": "bezier",
            },
          },
        ],
        layout: { name: "cose", animate: false, padding: 30, nodeRepulsion: 9000 },
        wheelSensitivity: 0.2,
      });

      cy.on("tap", "node", (evt: { target: { data: () => GraphNode } }) => {
        setSelected(evt.target.data());
      });
      cy.on("tap", (evt: { target: unknown }) => {
        if (evt.target === cy) setSelected(null);
      });

      cyRef.current = cy as unknown as { destroy: () => void };
    })();

    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [visible]);

  const toggle = (t: GraphNodeType) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  if (data.nodes.length === 0) {
    return (
      <div className="border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Nothing to plot yet — create a job, project or document and its relationships appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend doubles as the type filter */}
      <div className="flex flex-wrap items-center gap-2 border border-border bg-card p-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Filter
        </span>
        {presentTypes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className={cn(
              "flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] transition-opacity",
              hidden.has(t) ? "border-border opacity-40" : "border-transparent bg-secondary",
            )}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: NODE_COLOURS[t] }}
            />
            {NODE_LABELS[t]}
            <span className="text-muted-foreground">
              ({data.nodes.filter((n) => n.type === t).length})
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="h-[620px] w-full border border-border bg-card"
          role="application"
          aria-label="Relationship graph"
        />

        {selected && (
          <aside className="absolute right-3 top-3 w-72 border border-border bg-card p-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Badge variant="secondary" className="mb-1">
                  {NODE_LABELS[selected.type]}
                </Badge>
                <h3 className="truncate text-sm font-semibold">{selected.label}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setSelected(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {selected.detail && (
              <p className="mt-2 text-xs text-muted-foreground">{selected.detail}</p>
            )}
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Connected
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-auto text-xs">
                {data.edges
                  .filter((e) => e.source === selected.id || e.target === selected.id)
                  .map((e, i) => {
                    const otherId = e.source === selected.id ? e.target : e.source;
                    const other = data.nodes.find((n) => n.id === otherId);
                    if (!other) return null;
                    return (
                      <li key={i} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: NODE_COLOURS[other.type] }}
                        />
                        <span className="truncate">{other.label}</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
            {selected.href && (
              <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                <Link href={selected.href}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </Link>
              </Button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
