/** Shared shapes for the relationship explorer. */
export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  href?: string;
  detail?: string;
}
export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type GraphNodeType =
  | "client"
  | "project"
  | "job"
  | "document"
  | "supplier"
  | "material"
  | "personnel"
  | "equipment"
  | "ncr";

/** Entity colours — deliberately aligned with the app's Job Book palette. */
export const NODE_COLOURS: Record<GraphNodeType, string> = {
  client: "#0E2841",
  project: "#156082",
  job: "#E97132",
  document: "#7c8ea3",
  supplier: "#00B050",
  material: "#a0522d",
  personnel: "#9333ea",
  equipment: "#0F9ED5",
  ncr: "#c0392b",
};

export const NODE_LABELS: Record<GraphNodeType, string> = {
  client: "Client",
  project: "Project",
  job: "Job",
  document: "Document",
  supplier: "Supplier",
  material: "Material",
  personnel: "Personnel",
  equipment: "Equipment",
  ncr: "NCR",
};
