"use client";

import { Ban, ShieldCheck, UserRound } from "lucide-react";
import type { ApplicationStatus, EventStatus, PaymentStatus, UserRole, VerificationStatus } from "../../types/admin";
import { useConsole } from "../shell/ConsoleContext";
import { Badge, type BadgeTone } from "../ui/primitives";

/** A person's name that opens their profile drawer. */
export function PersonLink({
  id,
  name,
  secondary,
  className,
}: {
  id: string | null | undefined;
  name: string | null | undefined;
  /** e.g. email, shown below the name. */
  secondary?: string | null;
  className?: string;
}) {
  const { openUser } = useConsole();
  const label = name || "Unknown person";
  if (!id) return <span className={className}>{label}</span>;
  return (
    <span className={className}>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          openUser(id);
        }}
        className="rounded-sm text-left font-semibold text-forest underline decoration-forest/30 decoration-1 underline-offset-[3px] hover:decoration-forest"
      >
        {label}
      </button>
      {secondary ? <span className="block truncate text-meta text-ink-3">{secondary}</span> : null}
    </span>
  );
}

const EVENT_TONE: Record<EventStatus, BadgeTone> = {
  ACTIVE: "success",
  FEATURED: "forest",
  FULL: "info",
  SUSPENDED: "danger",
  CANCELLED: "outline",
  COMPLETED: "neutral",
  CLOSED: "neutral",
  DRAFT: "outline",
};

const EVENT_LABEL: Record<EventStatus, string> = {
  ACTIVE: "Active",
  FEATURED: "Featured",
  FULL: "Full",
  SUSPENDED: "Suspended",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  DRAFT: "Draft",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={EVENT_TONE[status] ?? "neutral"}>{EVENT_LABEL[status] ?? status}</Badge>;
}

export function eventStatusLabel(status: EventStatus): string {
  return EVENT_LABEL[status] ?? status;
}

const APP_TONE: Record<ApplicationStatus, BadgeTone> = {
  PENDING: "outline",
  UNDER_REVIEW: "neutral",
  APPROVED: "success",
  REJECTED: "danger",
  WAITLISTED: "info",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const label = status === "UNDER_REVIEW" ? "Under review" : status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge tone={APP_TONE[status] ?? "neutral"}>{label}</Badge>;
}

const PAY_TONE: Record<PaymentStatus, BadgeTone> = { PENDING: "outline", SUCCESS: "success", FAILED: "danger" };
const PAY_LABEL: Record<PaymentStatus, string> = { PENDING: "Pending", SUCCESS: "Paid", FAILED: "Failed" };

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAY_TONE[status]}>{PAY_LABEL[status]}</Badge>;
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === "APPROVED") return <Badge tone="success" icon={ShieldCheck}>Verified</Badge>;
  if (status === "REJECTED") return <Badge tone="danger">Rejected</Badge>;
  return <Badge tone="outline">Pending review</Badge>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  if (role === "ADMIN") return <Badge tone="forest">Admin</Badge>;
  if (role === "ORGANIZER") return <Badge tone="info">Organizer</Badge>;
  return <Badge tone="neutral">Volunteer</Badge>;
}

/**
 * Under-18 marker. The platform admits 16-year-olds, so this is the most
 * important flag on a safety screen. Deep forest, not red: it is a fact that
 * changes how to act, not an error.
 */
export function MinorBadge({ age }: { age?: number | null }) {
  return (
    <Badge tone="forest" icon={UserRound} title="Under 18">
      Under 18{age != null ? ` · ${age}` : ""}
    </Badge>
  );
}

export function BannedBadge() {
  return (
    <Badge tone="danger" icon={Ban}>
      Suspended
    </Badge>
  );
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  DONATION: "Donation",
  PREMIUM_SUBSCRIBER: "Premium subscription",
  FEATURED_EVENT_FEE: "Featured drive fee",
};

export function paymentTypeLabel(type: string): string {
  return PAYMENT_TYPE_LABEL[type] ?? type;
}
