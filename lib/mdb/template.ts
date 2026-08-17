/**
 * The standard Manufacturing Data Book layout: 12 chapters, 52 sections.
 *
 * Transcribed from the industry MDB template the shop already works to. This
 * is the *starting point* for a job's book — the rows are copied into
 * job_mdb_sections when a book is created, and from then on each job owns its
 * own copy: sections can be marked not applicable, retitled, reordered, or
 * added to without touching this file or any other job.
 *
 * `code` is the tab marker printed on the divider page (ITP, WPS, NDE…).
 */

export interface MdbTemplateSection {
  section_no: string;
  code: string;
  chapter_no: string;
  section_title: string;
}

/** Chapter number -> chapter heading. */
export const MDB_CHAPTERS: Record<string, string> = {
  "1": "General / Project Information",
  "2": "Engineering Documentation",
  "3": "Material Documentation",
  "4": "Welding Documentation",
  "5": "Heat Treatment Documentation",
  "6": "Non-Destructive Examination (NDE / NDT)",
  "7": "Dimensional Control",
  "8": "Pressure Testing",
  "9": "Surface Treatment / Coating",
  "10": "Factory Acceptance Testing (FAT)",
  "11": "Preservation & Packing",
  "12": "Operations & Maintenance",
};

export const MDB_TEMPLATE: MdbTemplateSection[] = [
  { section_no: "1.1", code: "ITP", chapter_no: "1", section_title: "Inspection & Test Plan" },
  { section_no: "1.2", code: "DEV", chapter_no: "1", section_title: "Deviations and Concessions" },
  { section_no: "1.3", code: "NCR", chapter_no: "1", section_title: "Non-Conformance Reports" },
  { section_no: "1.4", code: "COC", chapter_no: "1", section_title: "Certificate of Compliance" },
  { section_no: "1.5", code: "RELS", chapter_no: "1", section_title: "Release Note / Shipping Release" },

  { section_no: "2.1", code: "GA", chapter_no: "2", section_title: "General Arrangement Drawings" },
  { section_no: "2.2", code: "CALC", chapter_no: "2", section_title: "Calculations" },
  { section_no: "2.3", code: "ASBL", chapter_no: "2", section_title: "As-Built Drawings" },

  { section_no: "3.1", code: "TRACE", chapter_no: "3", section_title: "Material Traceability List" },
  { section_no: "3.2", code: "MTC", chapter_no: "3", section_title: "Material Certificates" },
  { section_no: "3.3", code: "PMI", chapter_no: "3", section_title: "Positive Material Identification" },
  { section_no: "3.4", code: "HARD", chapter_no: "3", section_title: "Hardness Testing" },

  { section_no: "4.1", code: "WMAP", chapter_no: "4", section_title: "Weld Maps" },
  { section_no: "4.2", code: "WPS", chapter_no: "4", section_title: "Welding Procedure Specifications" },
  { section_no: "4.3", code: "PQR", chapter_no: "4", section_title: "Procedure Qualification Records" },
  { section_no: "4.4", code: "WCON", chapter_no: "4", section_title: "Welding Consumable Certificates" },
  { section_no: "4.5", code: "WTRC", chapter_no: "4", section_title: "Weld Traceability Records" },
  { section_no: "4.6", code: "WQ", chapter_no: "4", section_title: "Welder Qualification Records" },

  { section_no: "5.1", code: "HTP", chapter_no: "5", section_title: "Heat Treatment Procedures" },
  { section_no: "5.2", code: "PWHTR", chapter_no: "5", section_title: "PWHT Reports" },
  { section_no: "5.3", code: "HTCH", chapter_no: "5", section_title: "Heat Treatment Charts" },
  { section_no: "5.4", code: "TCAL", chapter_no: "5", section_title: "Thermocouple Calibration Certificates" },

  { section_no: "6.1", code: "NSUM", chapter_no: "6", section_title: "NDE Summary" },
  { section_no: "6.2", code: "NPRO", chapter_no: "6", section_title: "NDE Procedures" },
  { section_no: "6.3", code: "RT", chapter_no: "6", section_title: "Radiographic Testing" },
  { section_no: "6.4", code: "MT", chapter_no: "6", section_title: "Magnetic Particle Testing" },
  { section_no: "6.5", code: "VT", chapter_no: "6", section_title: "Visual Testing" },
  { section_no: "6.6", code: "NQP", chapter_no: "6", section_title: "NDE Personnel Qualifications" },
  { section_no: "6.7", code: "NCAL", chapter_no: "6", section_title: "NDE Calibration Certificates" },

  { section_no: "7.1", code: "DREP", chapter_no: "7", section_title: "Dimensional Inspection Reports" },
  { section_no: "7.2", code: "FDIM", chapter_no: "7", section_title: "Final Dimensional Inspection" },
  { section_no: "7.3", code: "ROUND", chapter_no: "7", section_title: "Roundness Reports" },

  { section_no: "8.1", code: "HTPR", chapter_no: "8", section_title: "Hydrostatic Test Procedures" },
  { section_no: "8.2", code: "HTR", chapter_no: "8", section_title: "Hydrostatic Test Reports" },
  { section_no: "8.3", code: "PTR", chapter_no: "8", section_title: "Pneumatic Test Reports" },
  { section_no: "8.4", code: "GCAL", chapter_no: "8", section_title: "Gauge Calibration Certificates" },

  { section_no: "9.1", code: "BLST", chapter_no: "9", section_title: "Blast Cleaning Reports" },
  { section_no: "9.2", code: "PAINT", chapter_no: "9", section_title: "Paint Reports" },
  { section_no: "9.3", code: "DFT", chapter_no: "9", section_title: "Dry Film Thickness Reports" },
  { section_no: "9.4", code: "PSPEC", chapter_no: "9", section_title: "Paint System Specifications" },

  { section_no: "10.1", code: "FPROC", chapter_no: "10", section_title: "FAT Procedures" },
  { section_no: "10.2", code: "FRPT", chapter_no: "10", section_title: "FAT Reports" },
  { section_no: "10.3", code: "PUNCH", chapter_no: "10", section_title: "FAT Punch List" },
  { section_no: "10.4", code: "FREL", chapter_no: "10", section_title: "FAT Release Certificate" },

  { section_no: "11.1", code: "PPROC", chapter_no: "11", section_title: "Preservation Procedures" },
  { section_no: "11.2", code: "PREC", chapter_no: "11", section_title: "Preservation Records" },
  { section_no: "11.3", code: "LIFT", chapter_no: "11", section_title: "Lifting Procedures" },
  { section_no: "11.4", code: "TDRAW", chapter_no: "11", section_title: "Transport Drawings" },

  { section_no: "12.1", code: "OMAN", chapter_no: "12", section_title: "Operating Manual" },
  { section_no: "12.2", code: "MMAN", chapter_no: "12", section_title: "Maintenance Manual" },
  { section_no: "12.3", code: "SPL", chapter_no: "12", section_title: "Spare Parts List" },
  { section_no: "12.4", code: "COM", chapter_no: "12", section_title: "Commissioning Procedure" },
];

/**
 * A steel-fabrication shop does not build pressure vessels every day. This is
 * the subset that applies to a typical structural steel job, offered as a
 * one-click starting point so the user is not marking 30 chapters "not
 * applicable" by hand. Everything else is still created, just as `pending`.
 */
export const MDB_STRUCTURAL_PRESET = new Set([
  "1.1", "1.2", "1.3", "1.4", "1.5",
  "2.1", "2.3",
  "3.1", "3.2",
  "4.1", "4.2", "4.3", "4.4", "4.5", "4.6",
  "6.1", "6.4", "6.5", "6.6",
  "7.1", "7.2",
  "9.1", "9.2", "9.3", "9.4",
  "11.2", "11.3", "11.4",
]);

export const MDB_STATUSES = [
  { value: "included", label: "Included", badge: "com" },
  { value: "pending", label: "Pending", badge: "inp" },
  { value: "not_applicable", label: "Not applicable", badge: "secondary" },
] as const;

export type MdbStatus = (typeof MDB_STATUSES)[number]["value"];

export const mdbStatusMeta = (status: string | null | undefined) =>
  MDB_STATUSES.find((s) => s.value === status) ?? MDB_STATUSES[1];
