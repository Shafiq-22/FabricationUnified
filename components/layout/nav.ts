import {
  LayoutDashboard,
  FolderKanban,
  Contact,
  ClipboardList,
  FileText,
  Truck,
  PackageCheck,
  ShieldCheck,
  Boxes,
  HardHat,
  MapPin,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Tier } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minTier: Tier;
}

/** Ordered to follow the workflow: plan → execute → support → admin. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, minTier: 1 },
  { href: "/projects", label: "Projects", icon: FolderKanban, minTier: 1 },
  { href: "/jobs", label: "Jobs", icon: ClipboardList, minTier: 1 },
  { href: "/contacts", label: "Point of Contact", icon: Contact, minTier: 1 },
  { href: "/documents", label: "Documents", icon: FileText, minTier: 1 },
  { href: "/procurement", label: "Procurement", icon: Truck, minTier: 2 },
  { href: "/inventory", label: "Inventory", icon: Boxes, minTier: 1 },
  { href: "/qa", label: "Quality", icon: ShieldCheck, minTier: 1 },
  { href: "/handover", label: "Handover", icon: PackageCheck, minTier: 1 },
  { href: "/records", label: "Personnel & Equip", icon: HardHat, minTier: 2 },
  { href: "/sites", label: "Sites", icon: MapPin, minTier: 3 },
  // Users now lives inside Settings as a sub-tab.
  { href: "/settings", label: "Settings", icon: Settings, minTier: 3 },
];
