"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { setJobMargins } from "@/app/(app)/jobs/[id]/worksheet/actions";
// Data and types come from a plain module: a "use server" file may only export
// async functions, so importing this array from the actions file would hand the
// client `undefined` and crash the page on render.
import {
  MARGIN_SECTIONS,
  type MarginMap,
  type MarginSection,
  type OverrideMap,
} from "@/lib/margins";


/**
 * Margin control, one row per costed section (Changes II item 4, replacing the
 * single global on/off from Changes I).
 *
 * Two separate things live here and they are deliberately not the same:
 *   - the **override** is stored on the job and really does move the quote;
 *     leaving it blank means "use the Settings default", shown as the
 *     placeholder so the inherited figure is always visible.
 *   - the **show** tick is a local cost-control view only. Turning it off
 *     strips that section's mark-up from what is displayed, and writes nothing.
 */
export function SectionMargins({
  jobId,
  defaults,
  overrides,
  shown,
  onShownChange,
  editable,
}: {
  jobId: string;
  /** Department defaults from Settings, used when a job sets no override. */
  defaults: MarginMap;
  /** This job's stored overrides; missing/null means inherit. */
  overrides: OverrideMap;
  shown: Record<MarginSection, boolean>;
  onShownChange: (next: Record<MarginSection, boolean>) => void;
  editable: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      MARGIN_SECTIONS.map((s) => [s.key, overrides[s.key] == null ? "" : String(overrides[s.key])]),
    ),
  );
  const [dirty, setDirty] = useState(false);

  const save = () =>
    start(async () => {
      const payload: OverrideMap = {};
      for (const s of MARGIN_SECTIONS) {
        const raw = (draft[s.key] ?? "").trim();
        payload[s.key] = raw === "" ? null : Number(raw);
      }
      const res = await setJobMargins(jobId, payload);
      if (res.error) {
        toast({ variant: "destructive", title: "Could not save margins", description: res.error });
      } else {
        setDirty(false);
        toast({
          title: "Margins saved",
          description: "The quote has been recalculated for this job.",
        });
        router.refresh();
      }
    });

  const clearAll = () => {
    setDraft(Object.fromEntries(MARGIN_SECTIONS.map((s) => [s.key, ""])));
    setDirty(true);
  };

  return (
    <div className="panel-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-border px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide">Section Margins</h3>
          <p className="text-[11px] text-panel-foreground/60">
            Blank inherits the Settings default. A value here applies to this job only and changes
            its quote. The Show tick is a view control and saves nothing.
          </p>
        </div>
        {editable && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              disabled={pending}
              onClick={clearAll}
              title="Clear every override and go back to the Settings defaults"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Use defaults
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7"
              disabled={!dirty || pending}
              onClick={save}
            >
              <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save margins"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-x-6 gap-y-1 px-3 py-2 sm:grid-cols-2 lg:grid-cols-3">
        {MARGIN_SECTIONS.map((s) => {
          const inherited = overrides[s.key] == null;
          return (
            <div key={s.key} className="flex items-center gap-2 py-0.5 text-xs">
              <label className="flex items-center gap-1.5" title="Show this section's mark-up">
                <input
                  type="checkbox"
                  checked={shown[s.key]}
                  onChange={(e) => onShownChange({ ...shown, [s.key]: e.target.checked })}
                  className="h-3.5 w-3.5 accent-steel"
                />
                <span className="w-24 shrink-0">{s.label}</span>
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                disabled={!editable}
                value={draft[s.key] ?? ""}
                placeholder={`${defaults[s.key]} (default)`}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, [s.key]: e.target.value }));
                  setDirty(true);
                }}
                className="h-7 w-28 border border-panel-border bg-transparent px-1 text-right text-xs outline-none focus:ring-1 focus:ring-steel disabled:opacity-60"
              />
              <span className="text-panel-foreground/50">%</span>
              {!inherited && (
                <span className="text-[10px] uppercase tracking-wide text-amber">job</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
