import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

export interface TimesheetPdfRow {
  ho_no: string | null;
  name: string;
  trade: string | null;
  begin: string | null;
  end: string | null;
  normal: number | null;
  ot: number | null;
  total: number;
  site: string | null;
  job_name: string | null;
  job_description: string | null;
  job_ref: string | null;
}
export interface TimesheetPdfData {
  companyName: string;
  department: string;
  dateLabel: string; // e.g. "08 Jun 2026"
  rows: TimesheetPdfRow[];
  totalHrs: number;
}

const TEAL = "#156082";
const s = StyleSheet.create({
  page: { padding: 22, fontSize: 8, fontFamily: "Helvetica", color: "#0E2841" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: `2 solid ${TEAL}`, paddingBottom: 6, marginBottom: 8 },
  logo: { width: 130, height: 30, objectFit: "contain" },
  title: { fontSize: 12, fontWeight: "bold" },
  sub: { fontSize: 8, color: "#374151", textAlign: "right" },
  table: { borderTop: "1 solid #c9d2dd", borderLeft: "1 solid #c9d2dd" },
  tr: { flexDirection: "row" },
  th: { backgroundColor: "#D6DCE4", padding: 3, fontWeight: "bold", borderRight: "1 solid #c9d2dd", borderBottom: "1 solid #c9d2dd", fontSize: 7 },
  td: { padding: 3, borderRight: "1 solid #c9d2dd", borderBottom: "1 solid #c9d2dd", fontSize: 7 },
  footRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  sign: { fontSize: 8, borderTop: "1 solid #9ca3af", paddingTop: 3, width: 180, textAlign: "center" },
});
const c = (w: string, a: "left" | "right" | "center" = "left") => ({ width: w, textAlign: a } as const);
const COLS: [string, string, "left" | "right" | "center"][] = [
  ["#", "4%", "left"], ["HO No", "7%", "left"], ["Name", "14%", "left"], ["Trade", "8%", "left"],
  ["Begin", "6%", "center"], ["End", "6%", "center"], ["Nor", "5%", "right"], ["O/T", "5%", "right"], ["T~Hrs", "6%", "right"],
  ["Site", "8%", "left"], ["Job Name", "11%", "left"], ["Job Description", "14%", "left"], ["Job Ref", "10%", "left"],
];

export function TimesheetDocument(d: TimesheetPdfData) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={s.logo} src="/baf-logo.jpg" />
          <View>
            <Text style={s.title}>BAF ATTENDANCE — {d.dateLabel}</Text>
            <Text style={s.sub}>{d.companyName} · {d.department}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tr}>
            {COLS.map(([h, w, a]) => <Text key={h} style={[s.th, c(w, a)]}>{h}</Text>)}
          </View>
          {d.rows.map((r, i) => (
            <View style={s.tr} key={i}>
              <Text style={[s.td, c("4%")]}>{i + 1}</Text>
              <Text style={[s.td, c("7%")]}>{r.ho_no ?? ""}</Text>
              <Text style={[s.td, c("14%")]}>{r.name}</Text>
              <Text style={[s.td, c("8%")]}>{r.trade ?? ""}</Text>
              <Text style={[s.td, c("6%", "center")]}>{r.begin ?? ""}</Text>
              <Text style={[s.td, c("6%", "center")]}>{r.end ?? ""}</Text>
              <Text style={[s.td, c("5%", "right")]}>{r.normal ?? ""}</Text>
              <Text style={[s.td, c("5%", "right")]}>{r.ot ?? ""}</Text>
              <Text style={[s.td, c("6%", "right")]}>{r.total || ""}</Text>
              <Text style={[s.td, c("8%")]}>{r.site ?? ""}</Text>
              <Text style={[s.td, c("11%")]}>{r.job_name ?? ""}</Text>
              <Text style={[s.td, c("14%")]}>{r.job_description ?? ""}</Text>
              <Text style={[s.td, c("10%")]}>{r.job_ref ?? ""}</Text>
            </View>
          ))}
          <View style={s.tr}>
            <Text style={[s.td, c("55%"), { fontWeight: "bold", textAlign: "right" }]}>TOTAL HRS</Text>
            <Text style={[s.td, c("6%", "right"), { fontWeight: "bold" }]}>{d.totalHrs || ""}</Text>
            <Text style={[s.td, c("43%")]}> </Text>
          </View>
        </View>

        <View style={s.footRow}>
          <Text style={s.sign}>WORKSHOP ENGINEER</Text>
          <Text style={s.sign}>F/M</Text>
        </View>
      </Page>
    </Document>
  );
}
