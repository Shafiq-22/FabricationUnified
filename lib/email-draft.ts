/**
 * Builds `mailto:` drafts. Nothing is sent from the app — the link opens the
 * user's own mail client with the message pre-filled, so it goes out from
 * their mailbox with their signature and stays in their sent items.
 */

export interface DraftLine {
  item: string;
  dimension?: string | null;
  grade?: string | null;
  qty: number | null;
  unit: string | null;
  note?: string | null;
}

export interface MaterialDraft {
  to?: string | null;
  cc?: string | null;
  companyName: string;
  departmentName: string;
  jobCode: string;
  jobDescription?: string | null;
  siteCode?: string | null;
  projectCode?: string | null;
  requiredBy?: string | null;
  lines: DraftLine[];
  senderName: string;
}

export function materialRequestDraft(d: MaterialDraft): string {
  const subject =
    `Material Request — ${d.jobCode}` +
    (d.jobDescription ? ` — ${d.jobDescription}` : "");

  // A numbered list, not a plain-text table: mail clients reflow proportional
  // text and a column layout collapses, whereas numbered lines survive.
  // Job, scope, site, required-by and the sign-off are deliberately absent —
  // the mail client already carries the sender's signature.
  const describe = (l: DraftLine) =>
    [l.item, l.dimension, l.grade].filter(Boolean).join(" ");

  const list = d.lines.map((l, i) => {
    const qty = [l.qty == null ? null : String(l.qty), l.unit].filter(Boolean).join(" ");
    return (
      `${i + 1}. ${describe(l)}` +
      (qty ? ` — ${qty}` : "") +
      (l.note ? ` (${l.note})` : "")
    );
  });

  const body = [
    "Dear Sir/Madam,",
    "",
    "Please quote and supply the following materials for the job below.",
    "",
    ...list,
    "",
    "Kindly confirm availability, unit rates and delivery date.",
  ].join("\n");

  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  if (d.cc) params.set("cc", d.cc);

  // encodeURIComponent leaves the spaces URLSearchParams turned into '+',
  // which mail clients render literally. Newlines must be %0A, not '+'.
  const qs = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(d.to ?? "").replace(/%40/g, "@")}?${qs}`;
}

export interface TransferNotice {
  to?: string | null;
  companyName: string;
  departmentName: string;
  senderName: string;
  jobDescription: string;
  qty?: number | null;
  poRef?: string | null;
  supplier?: string | null;
  siteLabel?: string | null;
  expectedCompletion?: string | null;
  remark?: string | null;
}

/**
 * Notice that a handover item is being transferred to site. Same principle as
 * the material request: it opens in the user's mail client, it is not sent.
 */
export function transferNoticeDraft(d: TransferNotice): string {
  const subject = `Transfer Notice — ${d.jobDescription}`;

  const detail = [
    `Item:      ${d.jobDescription}`,
    d.qty != null ? `Quantity:  ${d.qty}` : null,
    d.siteLabel ? `Site:      ${d.siteLabel}` : null,
    d.poRef ? `PO Ref:    ${d.poRef}` : null,
    d.supplier ? `Supplier:  ${d.supplier}` : null,
    d.expectedCompletion ? `Expected:  ${d.expectedCompletion}` : null,
  ].filter(Boolean) as string[];

  const body = [
    "Dear Sir/Madam,",
    "",
    "Please be informed that the following item is ready for transfer from the",
    "fabrication workshop to site.",
    "",
    ...detail,
    // Blank lines above and below are deliberate paragraph breaks; only the
    // remarks block is conditional.
    ...(d.remark ? ["", `Remarks:   ${d.remark}`] : []),
    "",
    "Kindly arrange to receive and acknowledge on delivery.",
    "",
    "Thank you.",
    "",
    d.senderName,
    d.departmentName,
    d.companyName,
  ].join("\n");

  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  const qs = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(d.to ?? "").replace(/%40/g, "@")}?${qs}`;
}

export interface CertRenewalDraft {
  to?: string | null;
  cc?: string | null;
  companyName: string;
  departmentName: string;
  senderName: string;
  welders: {
    name: string;
    hoNo?: string | null;
    position?: string | null;
    certificateNo?: string | null;
    expiresOn?: string | null;
  }[];
}

/**
 * Enquiry to the certifying body to renew welder qualifications. Numbered
 * like the material request, for the same reason: mail clients reflow
 * proportional text and a column layout collapses.
 */
export function certRenewalDraft(d: CertRenewalDraft): string {
  const subject =
    d.welders.length === 1
      ? `Welder Qualification Renewal — ${d.welders[0].name}`
      : `Welder Qualification Renewal — ${d.welders.length} welders`;

  const list = d.welders.map((w, i) =>
    [
      `${i + 1}. ${w.name}`,
      w.hoNo ? `HO ${w.hoNo}` : null,
      w.position ? `position ${w.position}` : null,
      w.certificateNo ? `cert ${w.certificateNo}` : null,
      w.expiresOn ? `expires ${w.expiresOn}` : null,
    ]
      .filter(Boolean)
      .join(" — "),
  );

  const body = [
    "Dear Sir/Madam,",
    "",
    "Please arrange renewal of the welder qualifications listed below.",
    "",
    ...list,
    "",
    "Kindly confirm your charges, the testing date and the documents required.",
  ].join("\n");

  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  if (d.cc) params.set("cc", d.cc);
  const qs = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(d.to ?? "").replace(/%40/g, "@")}?${qs}`;
}

/** Heads-up to the welder (or their supervisor) that a ticket is running out. */
export function certExpiryNoticeDraft(d: {
  to?: string | null;
  companyName: string;
  departmentName: string;
  senderName: string;
  welderName: string;
  hoNo?: string | null;
  position?: string | null;
  expiresOn?: string | null;
  daysLeft?: number | null;
}): string {
  const subject = `Welder Qualification Expiring — ${d.welderName}`;
  const body = [
    "Dear Sir/Madam,",
    "",
    `The welding qualification below is due to expire${
      d.daysLeft != null ? ` in ${d.daysLeft} day(s)` : ""
    }.`,
    "",
    `Welder:    ${d.welderName}`,
    ...(d.hoNo ? [`HO No:     ${d.hoNo}`] : []),
    ...(d.position ? [`Position:  ${d.position}`] : []),
    ...(d.expiresOn ? [`Expires:   ${d.expiresOn}`] : []),
    "",
    "Please arrange re-testing before the expiry date so the welder can",
    "continue on certified work without interruption.",
    "",
    "Thank you.",
    "",
    d.senderName,
    d.departmentName,
    d.companyName,
  ].join("\n");

  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  const qs = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(d.to ?? "").replace(/%40/g, "@")}?${qs}`;
}
