import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  unit,
  hint,
  accent = "steel",
}: {
  label: string;
  value: string;
  unit?: string;
  /** Small caption under the figure, e.g. where the number comes from. */
  hint?: string;
  accent?: "steel" | "amber" | "neutral" | "positive" | "negative";
}) {
  const accentClass = {
    steel: "text-steel border-l-steel",
    amber: "text-amber border-l-amber",
    neutral: "text-foreground border-l-border",
    positive: "text-status-com border-l-status-com",
    negative: "text-destructive border-l-destructive",
  }[accent];

  return (
    <div
      className={cn(
        "border border-border border-l-2 bg-card p-4",
        accentClass,
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 tabular">
        <span className={cn("text-2xl font-semibold", accentClass)}>{value}</span>
        {unit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
