import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Truck,
  PackageCheck,
  Boxes,
  HardHat,
  MapPin,
  Users,
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

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, minTier: 1 },
  { href: "/jobs", label: "Jobs", icon: ClipboardList, minTier: 1 },
  { href: "/documents", label: "Documents", icon: FileText, minTier: 1 },
  { href: "/procurement", label: "Procurement", icon: Truck, minTier: 2 },
  { href: "/inventory", label: "Inventory", icon: Boxes, minTier: 1 },
  { href: "/handover", label: "Handover", icon: PackageCheck, minTier: 1 },
  { href: "/records", label: "Personnel & Equip", icon: HardHat, minTier: 2 },
  { href: "/sites", label: "Sites", icon: MapPin, minTier: 3 },
  { href: "/users", label: "Users", icon: Users, minTier: 3 },
  { href: "/settings", label: "Settings", icon: Settings, minTier: 3 },
];
