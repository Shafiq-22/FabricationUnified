import { format, parseISO, subMonths } from "date-fns";

/** 'yyyy-MM' for the current month (used as the dashboard/consumables key). */
export function currentMonthKey(): string {
  return format(new Date(), "yyyy-MM");
}

/** 'yyyy-MM' -> 'MMM yyyy' (e.g. '2026-05' -> 'May 2026'). */
export function monthLabel(ym: string): string {
  try {
    return format(parseISO(`${ym}-01`), "MMM yyyy");
  } catch {
    return ym;
  }
}

/** A descending list of the last `n` months as { value: 'yyyy-MM', label }. */
export function recentMonths(n = 18): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = subMonths(now, i);
    const value = format(d, "yyyy-MM");
    return { value, label: format(d, "MMM yyyy") };
  });
}

/** Format an ISO date string as 'dd MMM yyyy', or em-dash when empty. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd MMM yyyy");
  } catch {
    return d;
  }
}

/** Whole days between two ISO dates (or null). */
export function daysBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  if (!from || !to) return null;
  const ms = parseISO(to).getTime() - parseISO(from).getTime();
  return Math.round(ms / 86_400_000);
}
