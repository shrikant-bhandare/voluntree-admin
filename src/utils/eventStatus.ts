import { EventStatusValue } from "../types";

/**
 * Admin moderation actions on a drive, matching PATCH /events/:id/status in
 * the API contract:
 *   Feature    ACTIVE | FULL      -> FEATURED
 *   Unfeature  FEATURED           -> ACTIVE
 *   Suspend    ACTIVE | FEATURED | FULL | CLOSED -> SUSPENDED
 *   Reinstate  SUSPENDED          -> ACTIVE
 *   Cancel     any live state     -> CANCELLED
 * COMPLETED and CANCELLED are terminal, so those rows are read-only.
 */
export type AdminEventAction =
  | "FEATURE"
  | "UNFEATURE"
  | "SUSPEND"
  | "REINSTATE"
  | "CANCEL";

export interface EventActionDef {
  action: AdminEventAction;
  label: string;
  next: EventStatusValue;
  tone: "neutral" | "positive" | "danger";
  /** Confirm text, or null when the action needs no confirmation. */
  confirm: ((eventName: string) => string) | null;
}

export const TERMINAL_EVENT_STATUSES: EventStatusValue[] = ["COMPLETED", "CANCELLED"];

/** Collapse whitespace/newlines so a crafted name cannot reshape a confirm(). */
export function oneLine(text: string, max = 80): string {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

const DEFS: Record<AdminEventAction, EventActionDef> = {
  FEATURE: {
    action: "FEATURE",
    label: "Feature",
    next: "FEATURED",
    tone: "neutral",
    confirm: name =>
      `Feature "${oneLine(name)}"?\n\nFeaturing from the console waives the ₹999 promotion fee the organizer would otherwise pay. It stays featured until you unfeature it.`,
  },
  UNFEATURE: {
    action: "UNFEATURE",
    label: "Unfeature",
    next: "ACTIVE",
    tone: "neutral",
    confirm: null,
  },
  SUSPEND: {
    action: "SUSPEND",
    label: "Suspend",
    next: "SUSPENDED",
    tone: "danger",
    confirm: name =>
      `Suspend "${oneLine(name)}"?\n\nIt disappears from the public listing, every pending and approved volunteer is notified, and its organizer cannot reinstate it — only an administrator can.`,
  },
  REINSTATE: {
    action: "REINSTATE",
    label: "Reinstate",
    next: "ACTIVE",
    tone: "positive",
    confirm: null,
  },
  CANCEL: {
    action: "CANCEL",
    label: "Cancel drive",
    next: "CANCELLED",
    tone: "danger",
    confirm: name =>
      `Cancel "${oneLine(name)}"?\n\nEvery pending and approved volunteer is notified. CANCELLED is final — the drive cannot be reinstated afterwards.`,
  },
};

const ACTIONS_BY_STATUS: Record<EventStatusValue, AdminEventAction[]> = {
  DRAFT: ["CANCEL"],
  ACTIVE: ["FEATURE", "SUSPEND", "CANCEL"],
  FULL: ["FEATURE", "SUSPEND", "CANCEL"],
  FEATURED: ["UNFEATURE", "SUSPEND", "CANCEL"],
  CLOSED: ["SUSPEND", "CANCEL"],
  SUSPENDED: ["REINSTATE", "CANCEL"],
  COMPLETED: [],
  CANCELLED: [],
};

/** The actions an admin may take on a drive in `status` (empty = read-only). */
export function adminEventActions(status: EventStatusValue): EventActionDef[] {
  return (ACTIONS_BY_STATUS[status] ?? []).map(a => DEFS[a]);
}

export function findEventAction(
  status: EventStatusValue,
  action: AdminEventAction
): EventActionDef | null {
  return adminEventActions(status).find(d => d.action === action) ?? null;
}

/** Distinct badge colours per status. */
export const EVENT_STATUS_COLORS: Record<EventStatusValue, { fg: string; bg: string }> = {
  ACTIVE: { fg: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
  FEATURED: { fg: "#eab308", bg: "rgba(234, 179, 8, 0.15)" },
  FULL: { fg: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)" },
  CLOSED: { fg: "#fb923c", bg: "rgba(251, 146, 60, 0.15)" },
  DRAFT: { fg: "#cbd5e1", bg: "rgba(203, 213, 225, 0.12)" },
  COMPLETED: { fg: "#a78bfa", bg: "rgba(167, 139, 250, 0.15)" },
  SUSPENDED: { fg: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
  CANCELLED: { fg: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" },
};

export function eventStatusColors(status: EventStatusValue) {
  return EVENT_STATUS_COLORS[status] ?? { fg: "#ec4899", bg: "rgba(236, 72, 153, 0.15)" };
}

export const ALL_EVENT_STATUSES: EventStatusValue[] = [
  "ACTIVE",
  "FEATURED",
  "FULL",
  "SUSPENDED",
  "DRAFT",
  "CLOSED",
  "COMPLETED",
  "CANCELLED",
];
