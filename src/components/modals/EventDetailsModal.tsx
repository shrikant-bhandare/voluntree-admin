"use client";

import React, { useEffect, useRef } from "react";
import { EventItem } from "../../types";
import { exportToCsv } from "../../utils/csvExporter";
import {
  AdminEventAction,
  adminEventActions,
  eventStatusColors,
} from "../../utils/eventStatus";

interface EventDetailsModalProps {
  event: EventItem | null;
  onClose: () => void;
  onEventAction: (id: string, action: AdminEventAction) => void;
  onDeleteEvent: (id: string) => void;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = props => {
  if (!props.event) return null;
  // Mounted only while open, so focus capture/return runs once per opening.
  return <OpenEventDetailsModal {...props} event={props.event} />;
};

const OpenEventDetailsModal: React.FC<
  EventDetailsModalProps & { event: EventItem }
> = ({ event, onClose, onEventAction, onDeleteEvent }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus moves into the dialog on open, Escape closes it, Tab stays inside,
  // and focus returns to whatever opened it.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  const titleId = `event-modal-title-${event.id}`;

  const handleExportRoster = () => {
    if (!event.applications || event.applications.length === 0) return;
    exportToCsv(
      `${event.name.replace(/\s+/g, "_")}_roster`,
      ["Volunteer ID", "Full Name", "Email", "Application Status"],
      event.applications.map(app => [
        app.volunteer?.id || app.volunteerId || "N/A",
        app.volunteer?.fullName || "Volunteer Candidate",
        app.volunteer?.email || "N/A",
        app.status || "PENDING",
      ])
    );
  };

  const actions = adminEventActions(event.status);
  const statusColors = eventStatusColors(event.status);
  const approvedApplications = event.applications
    ? event.applications.filter((app: any) => app.status === "APPROVED").length
    : null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(11, 15, 25, 0.82)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onMouseDown={e => {
        // Backdrop click closes; clicks inside the dialog do not.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          backgroundColor: "#131a2c",
          border: "1px solid #334155",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "720px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
          padding: "32px",
          position: "relative",
          color: "white",
        }}
      >
        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close event details"
          style={{
            position: "absolute",
            top: "24px",
            right: "24px",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            color: "#94a3b8",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          ✕
        </button>

        {/* Header Info */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              backgroundColor: "rgba(99, 102, 241, 0.2)",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
            }}
          >
            🌱
          </div>
          <div style={{ flex: 1, paddingRight: "40px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "#6366f1",
                  backgroundColor: "rgba(99, 102, 241, 0.15)",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                }}
              >
                {event.category}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  backgroundColor: statusColors.bg,
                  color: statusColors.fg,
                }}
              >
                {event.status}
              </span>
            </div>
            <h2
              id={titleId}
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                color: "white",
                margin: 0,
                lineHeight: "1.3",
              }}
            >
              {event.name}
            </h2>
            <p
              style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0 0" }}
            >
              Host Organization:{" "}
              <strong style={{ color: "#cbd5e1" }}>{event.organizer}</strong> (
              {event.organizerEmail})
            </p>
          </div>
        </div>

        {/* Real-Time Admin Monitoring Metrics Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              backgroundColor: "#0b0f19",
              border: "1px solid #1e293b",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              👥 Approved Volunteers
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#6366f1",
                marginTop: "4px",
              }}
            >
              {approvedApplications ?? event.approvedCount} / {event.volunteersNeeded}
            </div>
            <div style={{ fontSize: "10px", color: "#64748b" }}>
              {event.volunteersApplied} application
              {event.volunteersApplied === 1 ? "" : "s"} in total
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#0b0f19",
              border: "1px solid #1e293b",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              ⏱️ Logged Impact Hours
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#10b981",
                marginTop: "4px",
              }}
            >
              {event.hoursLoggedTotal || 0} hrs
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#0b0f19",
              border: "1px solid #1e293b",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              🛡️ Safety Violations
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: event.reportsCount ? "#ef4444" : "#10b981",
                marginTop: "4px",
              }}
            >
              {event.reportsCount || 0} Flagged
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#0b0f19",
              border: "1px solid #1e293b",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              📄 Attendance Sessions
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#eab308",
                marginTop: "4px",
              }}
            >
              {event.attendanceCount || 0} Sessions
            </div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div
            style={{
              backgroundColor: "#0b0f19",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "18px",
              marginBottom: "20px",
            }}
          >
            <h4
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                textTransform: "uppercase",
                margin: "0 0 8px 0",
                fontWeight: "bold",
              }}
            >
              Description & Objective
            </h4>
            <p
              style={{
                fontSize: "14px",
                color: "#e2e8f0",
                margin: 0,
                lineHeight: "1.6",
              }}
            >
              {event.description}
            </p>
          </div>
        )}

        {/* Grid Specs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "#0b0f19",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              📍 Venue Address
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "white",
                fontWeight: "600",
                marginTop: "4px",
              }}
            >
              {event.location}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#0b0f19",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              🕒 Event Timing
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "white",
                fontWeight: "600",
                marginTop: "4px",
              }}
            >
              {event.startTime || "Scheduled Drive"}
              {event.endTime ? ` – ${event.endTime}` : ""}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#0b0f19",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              👥 Volunteer Capacity Progress
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "#10b981",
                fontWeight: "bold",
                marginTop: "4px",
              }}
            >
              {approvedApplications ?? event.approvedCount} / {event.volunteersNeeded} Slots Filled
            </div>
            <div
              style={{
                height: "6px",
                width: "100%",
                backgroundColor: "#334155",
                borderRadius: "4px",
                marginTop: "8px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((approvedApplications ?? event.approvedCount) /
                        (event.volunteersNeeded || 1)) *
                        100
                    )
                  )}%`,
                  backgroundColor: "#10b981",
                }}
              />
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#0b0f19",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              💰 Compensation & Min Age
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "white",
                fontWeight: "600",
                marginTop: "4px",
              }}
            >
              {event.isPaid
                ? `Paid Stipend (${event.compensationDetails || "Disbursed post drive"})`
                : "Community Volunteer"}
            </div>
            <div
              style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}
            >
              Age Requirement: {event.minAge ?? 16}+ years
            </div>
          </div>
        </div>

        {/* Open Positions & Perks */}
        {((event.openPositions && event.openPositions.length > 0) ||
          (event.perks && event.perks.length > 0)) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              marginBottom: "20px",
            }}
          >
            {event.openPositions && event.openPositions.length > 0 && (
              <div
                style={{
                  backgroundColor: "#0b0f19",
                  border: "1px solid #1e293b",
                  borderRadius: "14px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    marginBottom: "8px",
                    fontWeight: "bold",
                  }}
                >
                  Open Volunteer Roles
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {event.openPositions.map((pos: string, idx: number) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: "#1e293b",
                        color: "#cbd5e1",
                        fontSize: "11px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      {pos}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {event.perks && event.perks.length > 0 && (
              <div
                style={{
                  backgroundColor: "#0b0f19",
                  border: "1px solid #1e293b",
                  borderRadius: "14px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    marginBottom: "8px",
                    fontWeight: "bold",
                  }}
                >
                  Drive Perks
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {event.perks.map((perk: string, idx: number) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: "rgba(16, 185, 129, 0.15)",
                        color: "#10b981",
                        fontSize: "11px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      ✓ {perk}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Volunteer Applications Roster List */}
        <div
          style={{
            backgroundColor: "#0b0f19",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "18px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h4
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                textTransform: "uppercase",
                margin: 0,
                fontWeight: "bold",
              }}
            >
              Applicant Roster ({event.applications?.length || 0})
            </h4>
            {event.applications && event.applications.length > 0 && (
              <button
                onClick={handleExportRoster}
                style={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                📥 Export Roster CSV
              </button>
            )}
          </div>

          {event.applicationsError ? (
            <p style={{ fontSize: "12px", color: "#fca5a5", margin: 0 }}>
              ⚠️ {event.applicationsError}
            </p>
          ) : event.applications === undefined ? (
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
              Loading applicant roster…
            </p>
          ) : event.applications.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
              No volunteer applications submitted yet for this drive.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "160px",
                overflowY: "auto",
              }}
            >
              {event.applications.map((app: any, idx: number) => (
                <div
                  key={app.id || idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "12px",
                    borderBottom: "1px solid #1e293b",
                    paddingBottom: "8px",
                  }}
                >
                  <div>
                    <span style={{ color: "white", fontWeight: "600" }}>
                      {app.volunteer?.fullName || app.volunteerId || "Volunteer"}
                    </span>
                    <span style={{ color: "#64748b", marginLeft: "8px" }}>
                      {app.volunteer?.email}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      backgroundColor:
                        app.status === "APPROVED"
                          ? "rgba(16,185,129,0.15)"
                          : app.status === "REJECTED"
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(234,179,8,0.15)",
                      color:
                        app.status === "APPROVED"
                          ? "#10b981"
                          : app.status === "REJECTED"
                          ? "#ef4444"
                          : "#eab308",
                    }}
                  >
                    {app.status || "PENDING"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Admin Action Buttons Footer */}
        <div
          style={{
            borderTop: "1px solid #334155",
            paddingTop: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => onDeleteEvent(event.id)}
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              color: "#ef4444",
              padding: "10px 18px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            🗑️ Delete Drive
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            {actions.length > 0 ? (
              actions.map(def => (
                <button
                  key={def.action}
                  type="button"
                  onClick={() => onEventAction(event.id, def.action)}
                  style={{
                    backgroundColor:
                      def.tone === "danger"
                        ? "#7f1d1d"
                        : def.tone === "positive"
                        ? "#065f46"
                        : "#6366f1",
                    color: "white",
                    border: "none",
                    padding: "10px 16px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {def.label}
                </button>
              ))
            ) : (
              <span
                style={{ fontSize: "12px", color: "#94a3b8", alignSelf: "center" }}
                title="Completed and cancelled drives are final."
              >
                {event.status} — read-only
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                color: "white",
                padding: "10px 18px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
