"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Factory } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";
import type { Tier } from "@/lib/types";

export function Sidebar({ tier }: { tier: Tier }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const items = NAV_ITEMS.filter((i) => tier >= i.minTier);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-[hsl(220_18%_11%)] transition-[width] duration-150",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className="flex h-12 items-center gap-2 border-b border-border px-3">
        <Factory className="h-5 w-5 shrink-0 text-primary" />
        {!collapsed && (
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
            BAF&nbsp;Job&nbsp;Book
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-sm px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary border-l-2 border-primary"
                  : "border-l-2 border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex h-10 items-center gap-2 border-t border-border px-3 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <ChevronLeft
          className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
        />
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
