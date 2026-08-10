import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

/**
 * The quotation the client receives is deliberately a price, not a costing.
 * Material take-off, workforce hours and consumables stay internal to the
 * worksheet — the sheet the customer sees is the job and what it costs.
 */
export interface QuotationData {
  companyName: string;
  departmentName: string;
  job: {
    job_code: string | null;
    site_code: string | null;
    site_name: string | null;
    description: string | null;
    start_date: string | null;
    qty: number | null;
    unit: string | null;
  };
  quotationRef?: string | null;
  summary: {
    description: string | null;
    unit: string | null;
    qty: number | null;
    unit_cost: number | null;
    total: number;
  };
  finalQuote: number;
}

const aed = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const TEAL = "#156082";
const NAVY = "#0E2841";

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica", color: NAVY },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2 solid ${TEAL}`, paddingBottom: 8, marginBottom: 12 },
  logo: { width: 150, height: 34, objectFit: "contain" },
  dept: { fontSize: 8, color: "#374151", marginTop: 4 },
  docTitle: { fontSize: 15, fontWeight: "bold", textAlign: "right", color: TEAL, letterSpacing: 1 },
  jobCode: { fontSize: 10, textAlign: "right", marginTop: 2 },
  ref: { fontSize: 8, textAlign: "right", marginTop: 2, color: "#6b7280" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  metaItem: { width: "50%", marginBottom: 3 },
  metaLabel: { fontSize: 7, color: "#6b7280", textTransform: "uppercase" },
  metaValue: { fontSize: 9 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", marginTop: 10, marginBottom: 4, color: NAVY, textTransform: "uppercase" },
  table: { borderTop: "1 solid #c9d2dd", borderLeft: "1 solid #c9d2dd" },
  tr: { flexDirection: "row" },
  th: { backgroundColor: "#D6DCE4", padding: 5, fontWeight: "bold", borderRight: "1 solid #c9d2dd", borderBottom: "1 solid #c9d2dd", fontSize: 8 },
  td: { padding: 5, borderRight: "1 solid #c9d2dd", borderBottom: "1 solid #c9d2dd", fontSize: 8 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14, borderTop: `2 solid ${NAVY}`, paddingTop: 6 },
  totalLabel: { fontSize: 11, fontWeight: "bold", marginRight: 16 },
  totalValue: { fontSize: 13, fontWeight: "bold", color: TEAL },
  note: { fontSize: 7, color: "#6b7280", marginTop: 6 },
  footer: { position: "absolute", bottom: 22, left: 30, right: 30, fontSize: 7, color: "#9ca3af", textAlign: "center", borderTop: "1 solid #e5e7eb", paddingTop: 6 },
});

const c = (w: string, align: "left" | "right" = "left") => ({ width: w, textAlign: align } as const);

export function QuotationDocument(d: QuotationData) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={s.logo} src="/baf-logo.jpg" />
            <Text style={s.dept}>{d.departmentName}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>QUOTATION</Text>
            <Text style={s.jobCode}>{d.job.job_code}</Text>
            {d.quotationRef ? <Text style={s.ref}>Ref: {d.quotationRef}</Text> : null}
          </View>
        </View>

        <View style={s.metaGrid}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Site</Text>
            <Text style={s.metaValue}>{d.job.site_code} — {d.job.site_name}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Date</Text>
            <Text style={s.metaValue}>{d.job.start_date ?? "—"}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Quotation</Text>
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, c("52%")]}>Description</Text>
            <Text style={[s.th, c("10%")]}>Unit</Text>
            <Text style={[s.th, c("10%", "right")]}>Qty</Text>
            <Text style={[s.th, c("14%", "right")]}>Rate</Text>
            <Text style={[s.th, c("14%", "right")]}>Amount</Text>
          </View>
          <View style={s.tr}>
            <Text style={[s.td, c("52%")]}>{d.summary.description ?? d.job.description ?? ""}</Text>
            <Text style={[s.td, c("10%")]}>{d.summary.unit ?? ""}</Text>
            <Text style={[s.td, c("10%", "right")]}>{d.summary.qty ?? ""}</Text>
            <Text style={[s.td, c("14%", "right")]}>{aed(d.summary.unit_cost)}</Text>
            <Text style={[s.td, c("14%", "right")]}>{aed(d.summary.total)}</Text>
          </View>
        </View>

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>TOTAL (AED)</Text>
          <Text style={s.totalValue}>{aed(d.finalQuote)}</Text>
        </View>
        <Text style={s.note}>
          All prices in AED and inclusive of supply, fabrication and delivery as described above.
        </Text>

        <Text style={s.footer} fixed>
          {d.companyName} · {d.departmentName} · Generated {new Date().toLocaleDateString("en-GB")}
        </Text>
      </Page>
    </Document>
  );
}
