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
import type { AccessLevel } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Named access level, not a tier number — tier numbers are not ordinal
   * (see the tier model in lib/types). "all" is every signed-in tier.
   */
  access: AccessLevel;
}

/** Ordered to follow the workflow: plan → execute → support → admin. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, access: "all" },
  { href: "/projects", label: "Projects", icon: FolderKanban, access: "all" },
  { href: "/jobs", label: "Jobs", icon: ClipboardList, access: "all" },
  { href: "/contacts", label: "Point of Contact", icon: Contact, access: "all" },
  { href: "/documents", label: "Documents", icon: FileText, access: "all" },
  { href: "/procurement", label: "Procurement", icon: Truck, access: "all" },
  { href: "/inventory", label: "Inventory", icon: Boxes, access: "all" },
  { href: "/qa", label: "Quality", icon: ShieldCheck, access: "all" },
  { href: "/handover", label: "Handover", icon: PackageCheck, access: "all" },
  { href: "/records", label: "Personnel & Equip", icon: HardHat, access: "all" },
  { href: "/sites", label: "Sites", icon: MapPin, access: "admin" },
  // Users now lives inside Settings as a sub-tab.
  { href: "/settings", label: "Settings", icon: Settings, access: "admin" },
];
