import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

export interface EquipmentPdfRow {
  sixco_no: string | null;
  device_group: string | null;
  machine: string;
  make: string | null;
  type: string | null;
  codes: Record<number, string>;
  cost: number;
}
export interface EquipmentPdfData {
  companyName: string;
  department: string;
  monthLabel: string;
  days: number;
  rows: EquipmentPdfRow[];
  total: number;
}

const TEAL = "#156082";
const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const s = StyleSheet.create({
  page: { padding: 18, fontSize: 7, fontFamily: "Helvetica", color: "#0E2841" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: `2 solid ${TEAL}`, paddingBottom: 5, marginBottom: 6 },
  logo: { width: 130, height: 30, objectFit: "contain" },
  title: { fontSize: 12, fontWeight: "bold" },
  sub: { fontSize: 8, color: "#374151", textAlign: "right" },
  table: { borderTop: "1 solid #c9d2dd", borderLeft: "1 solid #c9d2dd" },
  tr: { flexDirection: "row" },
  th: { backgroundColor: "#D6DCE4", padding: 2, fontWeight: "bold", borderRight: "1 solid #c9d2dd", borderBottom: "1 solid #c9d2dd", fontSize: 6 },
  td: { padding: 2, borderRight: "1 solid #c9d2dd", borderBottom: "1 solid #c9d2dd", fontSize: 6 },
  foot: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  sign: { fontSize: 8, borderTop: "1 solid #9ca3af", paddingTop: 3, width: 180, textAlign: "center" },
});

const W = { sixco: 46, group: 30, machine: 120, make: 64, type: 74, day: 17, cost: 52 };

export function EquipmentDocument(d: EquipmentPdfData) {
  const dayList = Array.from({ length: d.days }, (_, i) => i + 1);
  return (
    <Document>
      <Page size="A3" orientation="landscape" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={s.logo} src="/baf-logo.jpg" />
          <View>
            <Text style={s.title}>BAF EQUIPMENT RECORD — {d.monthLabel}</Text>
            <Text style={s.sub}>{d.companyName} · {d.department}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, { width: W.sixco }]}>Sixco</Text>
            <Text style={[s.th, { width: W.group }]}>Grp</Text>
            <Text style={[s.th, { width: W.machine }]}>Machine</Text>
            <Text style={[s.th, { width: W.make }]}>Make</Text>
            <Text style={[s.th, { width: W.type }]}>Type</Text>
            {dayList.map((day) => <Text key={day} style={[s.th, { width: W.day, textAlign: "center" }]}>{day}</Text>)}
            <Text style={[s.th, { width: W.cost, textAlign: "right" }]}>Cost</Text>
          </View>
          {d.rows.map((r, i) => (
            <View style={s.tr} key={i}>
              <Text style={[s.td, { width: W.sixco }]}>{r.sixco_no ?? ""}</Text>
              <Text style={[s.td, { width: W.group }]}>{r.device_group ?? ""}</Text>
              <Text style={[s.td, { width: W.machine }]}>{r.machine}</Text>
              <Text style={[s.td, { width: W.make }]}>{r.make ?? ""}</Text>
              <Text style={[s.td, { width: W.type }]}>{r.type ?? ""}</Text>
              {dayList.map((day) => (
                <Text key={day} style={[s.td, { width: W.day, textAlign: "center" }]}>{r.codes[day] ?? ""}</Text>
              ))}
              <Text style={[s.td, { width: W.cost, textAlign: "right" }]}>{r.cost ? aed(r.cost) : ""}</Text>
            </View>
          ))}
          <View style={s.tr}>
            <Text style={[s.td, { width: W.sixco + W.group + W.machine + W.make + W.type + W.day * d.days, textAlign: "right", fontWeight: "bold" }]}>TOTAL</Text>
            <Text style={[s.td, { width: W.cost, textAlign: "right", fontWeight: "bold" }]}>{aed(d.total)}</Text>
          </View>
        </View>

        <View style={s.foot}>
          <Text style={s.sign}>WORKSHOP ENGINEER</Text>
          <Text style={s.sign}>F/M</Text>
        </View>
      </Page>
    </Document>
  );
}
