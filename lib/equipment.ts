// Equipment usage status codes and their (B; D) factors, applied to each
// equipment's bare-rate and driver-rate to derive the daily cost.
// NOTE: ON (Mobilization) / OFF (Demobilization) factors were not specified in
// the source; defaulted to ON=(1;1), OFF=(0;0) — adjust if needed.
export interface EquipStatus {
  code: string;
  label: string;
  b: number; // bare-rate factor
  d: number; // driver-rate factor
  desc: string;
}

export const EQUIPMENT_STATUS: EquipStatus[] = [
  { code: "ON", label: "Mobilization", b: 1, d: 1, desc: "Mobilization" },
  { code: "OFF", label: "Demobilization", b: 0, d: 0, desc: "Demobilization" },
  { code: "R", label: "Off-Hired", b: 0, d: 0, desc: "Standby without charge" },
  { code: "P", label: "Production", b: 1, d: 1, desc: "Normal Shift" },
  { code: "N", label: "Production", b: 1.75, d: 1.75, desc: "Double Shift" },
  { code: "F", label: "Fault", b: 0, d: 0, desc: "No charge" },
  { code: "S", label: "Standby", b: 0.25, d: 1, desc: "Standby" },
  { code: "B", label: "Breakdown", b: 0, d: 0, desc: "Breakdown" },
  { code: "A", label: "Accident", b: 0, d: 1, desc: "Accident" },
  { code: "T", label: "Production", b: 1.75, d: 1, desc: "TC/GC Double Shift" },
  { code: "E", label: "Production", b: 1.3, d: 1, desc: "Long Reach Excavator — Normal" },
  { code: "L", label: "Production", b: 2.275, d: 1.75, desc: "Long Reach Excavator — Double" },
];

export const STATUS_BY_CODE: Record<string, EquipStatus> = Object.fromEntries(
  EQUIPMENT_STATUS.map((s) => [s.code, s]),
);

/** Daily cost for one status code given the equipment's bare and driver rates. */
export function dayCost(
  code: string | null | undefined,
  bareRate: number | null | undefined,
  driverRate: number | null | undefined,
): number {
  if (!code) return 0;
  const s = STATUS_BY_CODE[code];
  if (!s) return 0;
  return s.b * (bareRate || 0) + s.d * (driverRate || 0);
}
