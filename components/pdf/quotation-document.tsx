import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

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
  materials: {
    material_name: string | null;
    unit: string | null;
    qty: number | null;
    unit_cost: number | null;
    total_cost: number | null;
  }[];
  workforce: {
    designation: string | null;
    qty: number | null;
    hrs_per_person: number | null;
    total_hours: number | null;
  }[];
  summary: {
    item_name: string | null;
    unit: string | null;
    qty: number | null;
    unit_cost: number | null;
    total_cost: number | null;
  }[];
  marginPct: number;
  finalQuote: number;
}

const aed = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", borderBottom: "2 solid #1f6feb", paddingBottom: 8, marginBottom: 12 },
  company: { fontSize: 16, fontWeight: "bold", color: "#1f6feb" },
  dept: { fontSize: 9, color: "#374151", marginTop: 2 },
  docTitle: { fontSize: 13, fontWeight: "bold", textAlign: "right" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  metaItem: { width: "50%", marginBottom: 3 },
  metaLabel: { fontSize: 7, color: "#6b7280", textTransform: "uppercase" },
  metaValue: { fontSize: 9 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", marginTop: 10, marginBottom: 4, color: "#1f2937", textTransform: "uppercase" },
  table: { borderTop: "1 solid #d1d5db", borderLeft: "1 solid #d1d5db" },
  tr: { flexDirection: "row" },
  th: { backgroundColor: "#f3f4f6", padding: 4, fontWeight: "bold", borderRight: "1 solid #d1d5db", borderBottom: "1 solid #d1d5db", fontSize: 8 },
  td: { padding: 4, borderRight: "1 solid #d1d5db", borderBottom: "1 solid #d1d5db", fontSize: 8 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10, borderTop: "2 solid #1f2937", paddingTop: 6 },
  totalLabel: { fontSize: 11, fontWeight: "bold", marginRight: 16 },
  totalValue: { fontSize: 13, fontWeight: "bold", color: "#1f6feb" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#9ca3af", textAlign: "center", borderTop: "1 solid #e5e7eb", paddingTop: 6 },
});

const col = (w: string, align: "left" | "right" = "left") => ({ width: w, textAlign: align } as const);

export function QuotationDocument(d: QuotationData) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.company}>{d.companyName}</Text>
            <Text style={s.dept}>{d.departmentName}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>QUOTATION</Text>
            <Text style={{ fontSize: 10, textAlign: "right", marginTop: 2 }}>{d.job.job_code}</Text>
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
          <View style={{ width: "100%", marginTop: 3 }}>
            <Text style={s.metaLabel}>Description</Text>
            <Text style={s.metaValue}>{d.job.description ?? "—"}</Text>
          </View>
        </View>

        {/* Material MTO */}
        <Text style={s.sectionTitle}>Material MTO</Text>
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, col("40%")]}>Material</Text>
            <Text style={[s.th, col("12%")]}>Unit</Text>
            <Text style={[s.th, col("14%", "right")]}>Qty</Text>
            <Text style={[s.th, col("17%", "right")]}>Unit Cost</Text>
            <Text style={[s.th, col("17%", "right")]}>Total</Text>
          </View>
          {d.materials.map((m, i) => (
            <View style={s.tr} key={i}>
              <Text style={[s.td, col("40%")]}>{m.material_name ?? ""}</Text>
              <Text style={[s.td, col("12%")]}>{m.unit ?? ""}</Text>
              <Text style={[s.td, col("14%", "right")]}>{m.qty ?? ""}</Text>
              <Text style={[s.td, col("17%", "right")]}>{aed(m.unit_cost)}</Text>
              <Text style={[s.td, col("17%", "right")]}>{aed(m.total_cost)}</Text>
            </View>
          ))}
        </View>

        {/* Workforce */}
        <Text style={s.sectionTitle}>Workforce</Text>
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, col("46%")]}>Designation</Text>
            <Text style={[s.th, col("18%", "right")]}>Qty</Text>
            <Text style={[s.th, col("18%", "right")]}>Hrs/Person</Text>
            <Text style={[s.th, col("18%", "right")]}>Total Hrs</Text>
          </View>
          {d.workforce.map((w, i) => (
            <View style={s.tr} key={i}>
              <Text style={[s.td, col("46%")]}>{w.designation ?? ""}</Text>
              <Text style={[s.td, col("18%", "right")]}>{w.qty ?? ""}</Text>
              <Text style={[s.td, col("18%", "right")]}>{w.hrs_per_person ?? ""}</Text>
              <Text style={[s.td, col("18%", "right")]}>{w.total_hours ?? ""}</Text>
            </View>
          ))}
        </View>

        {/* Quotation Summary */}
        <Text style={s.sectionTitle}>Quotation Summary</Text>
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, col("52%")]}>Item</Text>
            <Text style={[s.th, col("16%", "right")]}>Qty</Text>
            <Text style={[s.th, col("16%", "right")]}>Unit Cost</Text>
            <Text style={[s.th, col("16%", "right")]}>Total</Text>
          </View>
          {d.summary.map((it, i) => (
            <View style={s.tr} key={i}>
              <Text style={[s.td, col("52%")]}>{it.item_name ?? ""}</Text>
              <Text style={[s.td, col("16%", "right")]}>{it.qty ?? ""}</Text>
              <Text style={[s.td, col("16%", "right")]}>{aed(it.unit_cost)}</Text>
              <Text style={[s.td, col("16%", "right")]}>{aed(it.total_cost)}</Text>
            </View>
          ))}
          <View style={s.tr}>
            <Text style={[s.td, col("84%"), { fontWeight: "bold" }]}>
              Margin ({d.marginPct.toFixed(1)}%)
            </Text>
            <Text style={[s.td, col("16%", "right")]}>incl.</Text>
          </View>
        </View>

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>FINAL QUOTE (AED)</Text>
          <Text style={s.totalValue}>{aed(d.finalQuote)}</Text>
        </View>

        <Text style={s.footer} fixed>
          {d.companyName} · {d.departmentName} · Generated {new Date().toLocaleDateString("en-GB")}
        </Text>
      </Page>
    </Document>
  );
}
