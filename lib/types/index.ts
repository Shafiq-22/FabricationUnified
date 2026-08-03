import type { Database } from "./database";

// ---- Row helpers ----------------------------------------------------
type T = Database["public"]["Tables"];
type V = Database["public"]["Views"];

export type Job = T["jobs"]["Row"];
export type JobView = V["jobs_view"]["Row"];
export type JobInsert = T["jobs"]["Insert"];
export type JobUpdate = T["jobs"]["Update"];
export type Site = T["sites"]["Row"];
export type UserProfile = T["users"]["Row"];
export type RoleConfig = T["roles_config"]["Row"];
export type LabourRate = T["labour_rates"]["Row"];
export type QuoteMaterial = T["job_quote_materials"]["Row"];
export type ActualMaterial = T["job_actual_materials"]["Row"];
export type QuoteWorkforce = T["job_quote_workforce"]["Row"];
export type ActualWorkforce = T["job_actual_workforce"]["Row"];
export type QuotationSummary = T["job_quotation_summary"]["Row"];
export type ActualSummary = T["job_actual_summary"]["Row"];
export type QuoteConsumable = T["job_quote_consumables"]["Row"];
export type ActualConsumable = T["job_actual_consumables"]["Row"];
export type HistoricPrice = V["historic_prices"]["Row"];
export type JobComment = T["job_comments"]["Row"];
export type RoughSheetItem = T["rough_sheet_items"]["Row"];
export type RoughSheetAggregated = V["rough_sheet_aggregated"]["Row"];
export type CutListPlate = T["cut_list_plates"]["Row"];
export type CutListPlateAggregated = V["cut_list_plates_aggregated"]["Row"];
export type Consumable = T["consumables"]["Row"];
export type JobMaterial = T["job_materials"]["Row"];
export type HandoverItem = T["handover_items"]["Row"];
export type Drawing = T["drawings"]["Row"];
export type AuditEntry = T["audit_log"]["Row"];
export type Supplier = T["suppliers"]["Row"];
export type DocumentRow = T["documents"]["Row"];
export type Client = T["clients"]["Row"];
export type Project = T["projects"]["Row"];
export type ProjectView = V["projects_view"]["Row"];
export type Rfq = T["rfqs"]["Row"];
export type InspectionReport = T["inspection_reports"]["Row"];
export type Ncr = T["ncrs"]["Row"];
export type MaintenanceRecord = T["maintenance_records"]["Row"];

export const INSPECTION_RESULTS = [
  { value: "pass", label: "Pass", badge: "com" },
  { value: "fail", label: "Fail", badge: "hal" },
  { value: "conditional", label: "Conditional", badge: "inp" },
] as const;

export const NCR_STATUSES = [
  { value: "open", label: "Open", badge: "hal" },
  { value: "in_progress", label: "In Progress", badge: "inp" },
  { value: "closed", label: "Closed", badge: "com" },
] as const;

export const NCR_SEVERITIES = ["minor", "major", "critical"] as const;

export const MAINTENANCE_TYPES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "breakdown", label: "Breakdown" },
  { value: "inspection", label: "Inspection" },
  { value: "repair", label: "Repair" },
] as const;

export const EQUIPMENT_STATES = [
  { value: "operational", label: "Operational", badge: "com" },
  { value: "maintenance", label: "Maintenance", badge: "inp" },
  { value: "down", label: "Down", badge: "hal" },
] as const;

export const PROJECT_STATUSES = [
  { value: "rfq", label: "RFQ", badge: "qtn" },
  { value: "quoted", label: "Quoted", badge: "qtn" },
  { value: "won", label: "Won", badge: "com" },
  { value: "in_fabrication", label: "In Fabrication", badge: "inp" },
  { value: "qa", label: "QA", badge: "inp" },
  { value: "dispatch", label: "Dispatch", badge: "del" },
  { value: "installed", label: "Installed", badge: "com" },
  { value: "closed", label: "Closed", badge: "secondary" },
  { value: "lost", label: "Lost", badge: "hal" },
] as const;

export const RFQ_STATUSES = [
  { value: "open", label: "Open", badge: "inp" },
  { value: "quoted", label: "Quoted", badge: "qtn" },
  { value: "won", label: "Won", badge: "com" },
  { value: "lost", label: "Lost", badge: "hal" },
  { value: "cancelled", label: "Cancelled", badge: "secondary" },
] as const;

export const DOC_TYPES = [
  { value: "drawing", label: "Drawing" },
  { value: "po", label: "Purchase Order" },
  { value: "invoice", label: "Invoice" },
  { value: "inspection_report", label: "Inspection Report" },
  { value: "photo", label: "Photo" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
] as const;
export type InventoryItem = T["inventory_items"]["Row"];
export type InventoryItemView = V["inventory_items_view"]["Row"];
export type InventoryMovement = T["inventory_movements"]["Row"];

export const INVENTORY_TYPES = ["plate", "section", "consumable", "remnant"] as const;
export const MOVEMENT_TYPES = [
  { value: "receipt", label: "Receipt (in)", sign: 1 },
  { value: "issue", label: "Issue to job (out)", sign: -1 },
  { value: "remnant", label: "Remnant returned (in)", sign: 1 },
  { value: "adjustment", label: "Adjustment (±)", sign: 1 },
] as const;
export type Personnel = T["personnel"]["Row"];
export type Equipment = T["equipment"]["Row"];
export type TimesheetEntry = T["timesheet_entries"]["Row"];
export type EquipmentUsage = T["equipment_usage"]["Row"];

// ---- Domain enums ---------------------------------------------------
export type JobStatus =
  | "quotation"
  | "in_progress"
  | "completed"
  | "delivered"
  | "halt";

export const JOB_STATUSES: {
  value: JobStatus;
  label: string;
  prefix: string;
  badge: "qtn" | "inp" | "com" | "del" | "hal";
}[] = [
  { value: "quotation", label: "Quotation", prefix: "QTN", badge: "qtn" },
  { value: "in_progress", label: "In Progress", prefix: "INP", badge: "inp" },
  { value: "completed", label: "Completed", prefix: "COM", badge: "com" },
  { value: "delivered", label: "Delivered", prefix: "DEL", badge: "del" },
  { value: "halt", label: "Halt", prefix: "HAL", badge: "hal" },
];

export function statusMeta(status: string | null | undefined) {
  return JOB_STATUSES.find((s) => s.value === status) ?? JOB_STATUSES[0];
}

export type Tier = 1 | 2 | 3;

// The signed-in user's profile, joined with their tier's display name.
export interface SessionProfile {
  id: string;
  full_name: string;
  email: string | null;
  role_tier: Tier;
  active: boolean;
  role_name: string;
}

export const TIER_DEFAULT_NAMES: Record<Tier, string> = {
  1: "Plant Manager",
  2: "Fabrication Engineer",
  3: "Fabrication Manager",
};

export const canEdit = (tier: Tier) => tier >= 2;
export const canSeeFinancials = (tier: Tier) => tier >= 2;
export const isAdmin = (tier: Tier) => tier === 3;
