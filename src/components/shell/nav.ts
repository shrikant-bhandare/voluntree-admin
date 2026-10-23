import {
  BarChart3,
  Building2,
  CalendarDays,
  Clock,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldAlert,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AdminStats } from "../../types/admin";

export type ViewId =
  | "overview"
  | "reports"
  | "ngos"
  | "payments"
  | "drives"
  | "people"
  | "hours"
  | "feed"
  | "broadcasts"
  | "analytics"
  | "audit"
  | "settings";

export interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  /** Count shown next to the item (work waiting), from /admin/stats. */
  badge?: (s: AdminStats) => number;
  /** Phrase for the badge's accessible name, e.g. "open". */
  badgeNoun?: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * Grouped around admin jobs: work queues first, then the records you look
 * things up in, then tools. Settings lives in the account menu.
 */
export const NAV: NavGroup[] = [
  { label: null, items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Queues",
    items: [
      { id: "reports", label: "Safety reports", icon: ShieldAlert, badge: s => s.reports.open, badgeNoun: "open" },
      { id: "ngos", label: "NGO approvals", icon: Building2, badge: s => s.ngos.pending, badgeNoun: "pending" },
      { id: "payments", label: "Payments", icon: Wallet, badge: s => s.payments.pending, badgeNoun: "pending" },
    ],
  },
  {
    label: "Records",
    items: [
      { id: "drives", label: "Drives", icon: CalendarDays },
      { id: "people", label: "People", icon: Users },
      { id: "hours", label: "Volunteer hours", icon: Clock },
      { id: "feed", label: "Feed moderation", icon: MessagesSquare },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "broadcasts", label: "Broadcasts", icon: Megaphone },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { id: "settings", label: "Settings", icon: Settings };

export const ALL_VIEWS: ViewId[] = [...NAV.flatMap(g => g.items.map(i => i.id)), "settings"];

export function viewLabel(id: ViewId): string {
  return [...NAV.flatMap(g => g.items), SETTINGS_ITEM].find(i => i.id === id)?.label ?? "Overview";
}
