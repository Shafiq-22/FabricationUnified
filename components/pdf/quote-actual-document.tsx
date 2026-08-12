import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/**
 * INTERNAL cost comparison — quoted against actual, section by section.
 *
 * Deliberately not an extension of the customer quotation, which is a price
 * and nothing else. This sheet exposes the cost base, the margins and the
 * variance, so it is for the department, never for the client.
 */
export interface QuoteActualSection {
  name: string;
  quoted: number;
  actual: number;
  marginPct: number;
  /** True when the margin came from this job rather than Settings. */
  overridden: boolean;
}

export interface QuoteActualData {
  companyName: string;
  departmentName: string;
  job: {
    job_code: string | null;
    site_code: string | null;
    site_name: string | null;
    description: string | null;
    status: string | null;
  };
  sections: QuoteActualSection[];
  totalQuoted: number;
  totalActual: number;
  finalQuote: number;
  fromStockValue: number;
  generatedOn: string;
}

const aed = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-AE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);

const TEAL = "#156082";
const NAVY = "#0E2841";
const BAND = "#D6DCE4";
const RED = "#B3261E";
const GREEN = "#00B050";

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica", color: NAVY },
  header: { borderBottomWidth: 2, borderBottomColor: TEAL, paddingBottom: 6, marginBottom: 10 },
  company: { fontSize: 13, fontFamily: "Helvetica-Bold", color: TEAL },
  dept: { fontSize: 8, color: "#5A6B7B" },
  title: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 6 },
  internal: { fontSize: 7, color: RED, fontFamily: "Helvetica-Bold", marginTop: 2 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  meta: { width: "50%", marginBottom: 2 },
  metaLabel: { fontSize: 7, color: "#5A6B7B", textTransform: "uppercase" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E3E7EB" },
  headRow: { flexDirection: "row", backgroundColor: BAND },
  cell: { padding: 4 },
  cSection: { width: "28%" },
  cNum: { width: "18%", textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  totalRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: TEAL, marginTop: 2 },
  note: { marginTop: 12, fontSize: 7, color: "#5A6B7B" },
});

function variance(actual: number, quoted: number) {
  const v = actual - quoted;
  return { v, color: v > 0 ? RED : v < 0 ? GREEN : NAVY };
}

export function QuoteActualDocument(d: QuoteActualData) {
  const total = variance(d.totalActual, d.totalQuoted);
  return (
    <Document title={`${d.job.job_code ?? "job"} — quoted vs actual`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.company}>{d.companyName}</Text>
          <Text style={s.dept}>{d.departmentName}</Text>
          <Text style={s.title}>Quoted vs Actual — cost comparison</Text>
          <Text style={s.internal}>INTERNAL — contains cost base and margins. Not for issue to the client.</Text>
        </View>

        <View style={s.metaRow}>
          <View style={s.meta}>
            <Text style={s.metaLabel}>Job</Text>
            <Text>{d.job.job_code ?? "—"}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaLabel}>Site</Text>
            <Text>
              {d.job.site_code ?? "—"} {d.job.site_name ? `· ${d.job.site_name}` : ""}
            </Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaLabel}>Description</Text>
            <Text>{d.job.description ?? "—"}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaLabel}>Status / Generated</Text>
            <Text>
              {d.job.status ?? "—"} · {d.generatedOn}
            </Text>
          </View>
        </View>

        <View style={s.headRow}>
          <Text style={[s.cell, s.cSection, s.bold]}>Section</Text>
          <Text style={[s.cell, s.cNum, s.bold]}>Quoted</Text>
          <Text style={[s.cell, s.cNum, s.bold]}>Actual</Text>
          <Text style={[s.cell, s.cNum, s.bold]}>Variance</Text>
          <Text style={[s.cell, s.cNum, s.bold]}>Margin %</Text>
        </View>

        {d.sections.map((sec) => {
          const vr = variance(sec.actual, sec.quoted);
          return (
            <View key={sec.name} style={s.row}>
              <Text style={[s.cell, s.cSection]}>{sec.name}</Text>
              <Text style={[s.cell, s.cNum]}>{aed(sec.quoted)}</Text>
              <Text style={[s.cell, s.cNum]}>{aed(sec.actual)}</Text>
              <Text style={[s.cell, s.cNum, { color: vr.color }]}>
                {vr.v > 0 ? "+" : ""}
                {aed(vr.v)}
              </Text>
              <Text style={[s.cell, s.cNum]}>
                {sec.marginPct}
                {sec.overridden ? " (job)" : ""}
              </Text>
            </View>
          );
        })}

        <View style={s.totalRow}>
          <Text style={[s.cell, s.cSection, s.bold]}>Total (cost before margin)</Text>
          <Text style={[s.cell, s.cNum, s.bold]}>{aed(d.totalQuoted)}</Text>
          <Text style={[s.cell, s.cNum, s.bold]}>{aed(d.totalActual)}</Text>
          <Text style={[s.cell, s.cNum, s.bold, { color: total.color }]}>
            {total.v > 0 ? "+" : ""}
            {aed(total.v)}
          </Text>
          <Text style={[s.cell, s.cNum]} />
        </View>

        <View style={s.row}>
          <Text style={[s.cell, s.cSection, s.bold]}>Final quote (with margin)</Text>
          <Text style={[s.cell, s.cNum, s.bold]}>{aed(d.finalQuote)}</Text>
          <Text style={[s.cell, s.cNum]} />
          <Text style={[s.cell, s.cNum]} />
          <Text style={[s.cell, s.cNum]} />
        </View>

        {d.fromStockValue > 0 && (
          <Text style={s.note}>
            Of the actual material, {aed(d.fromStockValue)} was drawn from existing stock rather
            than bought for this job.
          </Text>
        )}
        <Text style={s.note}>
          Variance is actual less quoted: a positive figure means the job cost more than it was
          quoted at. Margin % marked &quot;(job)&quot; is an override set on this job; the rest come
          from Settings.
        </Text>
      </Page>
    </Document>
  );
}
