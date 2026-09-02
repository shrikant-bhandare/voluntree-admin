import { EventStatusValue } from "../types";

/**
 * The only status changes an admin makes from the console.
 *
 * Every other state (DRAFT, CLOSED, FULL, COMPLETED, CANCELLED) is owned by the
 * organizer or by the platform's own lifecycle — re-activating a completed
 * drive would reopen it for applications, and re-activating a CANCELLED one
 * would undo the takedown that rejecting its NGO performed.
 */
export function nextAdminStatus(
  status: EventStatusValue
): { next: EventStatusValue; label: string; destructive: boolean } | null {
  switch (status) {
    case "ACTIVE":
      return { next: "FEATURED", label: "⭐ Feature", destructive: false };
    case "FEATURED":
      return { next: "SUSPENDED", label: "🚫 Suspend", destructive: true };
    case "SUSPENDED":
      return { next: "ACTIVE", label: "✓ Reinstate", destructive: false };
    default:
      return null;
  }
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
