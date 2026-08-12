/**
 * The five costed worksheet sections, in the order the Quotation tab shows
 * them, with the `jobs` column each one's per-job override lives in.
 *
 * This lives in a plain module rather than beside the server actions that use
 * it, and it must stay that way: a `"use server"` file may only export async
 * functions. A non-async export from one is stripped out of the client bundle,
 * so a client component importing it receives `undefined` and throws on first
 * render — which is exactly what happened when this array was declared in
 * `worksheet/actions.ts` (every job page died with "a client-side exception
 * has occurred"). See FAILED APPROACHES in CONTINUATION.md.
 */
export const MARGIN_SECTIONS = [
  { key: "material", column: "margin_material_pct", label: "Material" },
  { key: "workforce", column: "margin_workforce_pct", label: "Workforce" },
  { key: "consumables", column: "margin_consumables_pct", label: "Consumables" },
  { key: "equipment", column: "margin_equipment_pct", label: "Equipment" },
  { key: "services", column: "margin_services_pct", label: "Services" },
] as const;

export type MarginSection = (typeof MARGIN_SECTIONS)[number]["key"];

/** A job's stored overrides; a missing or null entry means "inherit". */
export type OverrideMap = Partial<Record<MarginSection, number | null>>;

/** The department defaults from Settings. */
export type MarginMap = Record<MarginSection, number>;
