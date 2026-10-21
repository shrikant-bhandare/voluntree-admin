"use client";

import React from "react";
import { SafetyReport } from "../../types";
import { eventStatusColors } from "../../utils/eventStatus";
import { LoadMoreButton, TruncationNote } from "../common/FeedStatus";

interface SafetyReportsTabProps {
  reports: SafetyReport[];
  /** Exact open + resolved count from /admin/stats. */
  totalReports?: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onDismissReport: (reportId: string) => void;
  onSuspendReportedEvent: (reportId: string) => void;
  onInspectEvent: (reportId: string) => void;
  onFindUser: (email: string) => void;
}

const th: React.CSSProperties = {
  padding: "12px 8px",
  color: "#94a3b8",
  fontSize: "13px",
};

const smallButton: React.CSSProperties = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  color: "white",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "500",
};

export const SafetyReportsTab: React.FC<SafetyReportsTabProps> = ({
  reports,
  totalReports,
  hasMore,
  loadingMore,
  onLoadMore,
  onDismissReport,
  onSuspendReportedEvent,
  onInspectEvent,
  onFindUser,
}) => {
  return (
    <div
      style={{
        backgroundColor: "rgba(30, 41, 59, 0.45)",
        borderRadius: "16px",
        border: "1px solid #334155",
        padding: "24px",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <h3
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            color: "white",
            margin: 0,
          }}
        >
          Community Safety & Violation Flagged Reports
        </h3>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <TruncationNote
            shown={reports.length}
            hasMore={hasMore}
            total={totalReports}
            noun="reports (open first)"
          />
          <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
            Unresolved in view:{" "}
            <strong>{reports.filter(r => !r.resolved).length}</strong>
          </span>
        </div>
      </div>

      {reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            No safety reports have been filed.
          </p>
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            color: "white",
          }}
        >
          <thead>
            <tr
              style={{ borderBottom: "1px solid #334155", textAlign: "left" }}
            >
              <th scope="col" style={th}>Target</th>
              <th scope="col" style={th}>Violation Type</th>
              <th scope="col" style={th}>Reporter & Reason</th>
              <th scope="col" style={th}>Status</th>
              <th scope="col" style={{ ...th, textAlign: "right" }}>
                Moderation Action
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map(rep => {
              const isUser = rep.targetType === "USER";
              const targetEmail = rep.targetUser?.email;
              const statusColors = rep.eventStatus
                ? eventStatusColors(rep.eventStatus)
                : null;
              return (
                <tr
                  key={rep.id}
                  style={{
                    borderBottom: "1px solid #1e293b",
                    opacity: rep.resolved ? 0.6 : 1.0,
                  }}
                >
                  <td style={{ padding: "16px 8px", maxWidth: "260px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        backgroundColor: isUser
                          ? "rgba(99, 102, 241, 0.15)"
                          : "rgba(248, 113, 113, 0.15)",
                        color: isUser ? "#a5b4fc" : "#f87171",
                      }}
                    >
                      {isUser ? "USER" : "EVENT"}
                    </span>
                    {isUser ? (
                      <>
                        <div style={{ fontWeight: "bold", color: "#f87171", marginTop: "6px" }}>
                          {rep.targetUser?.fullName || "Unknown account"}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                          {rep.targetUser?.email || "—"}
                        </div>
                        {rep.messageId && (
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                            About a chat message
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: "bold", color: "#f87171", marginTop: "6px" }}>
                          {rep.eventName}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                          Organizer: {rep.organizerName || "—"}
                          {rep.organizerEmail ? ` (${rep.organizerEmail})` : ""}
                        </div>
                        {statusColors && (
                          <span
                            style={{
                              display: "inline-block",
                              marginTop: "4px",
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontWeight: "bold",
                              backgroundColor: statusColors.bg,
                              color: statusColors.fg,
                            }}
                          >
                            Drive {rep.eventStatus}
                          </span>
                        )}
                      </>
                    )}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        marginTop: "4px",
                      }}
                    >
                      Reported {rep.date}
                    </div>
                  </td>
                  <td style={{ padding: "16px 8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "3px 6px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        backgroundColor: "rgba(239, 68, 68, 0.15)",
                        color: "#ef4444",
                      }}
                    >
                      {rep.category}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "16px 8px",
                      fontSize: "13px",
                      maxWidth: "320px",
                    }}
                  >
                    <div style={{ fontWeight: "600", color: "#94a3b8" }}>
                      By: {rep.reporter}
                      {rep.reporterEmail ? ` (${rep.reporterEmail})` : ""}
                    </div>
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        color: "#cbd5e1",
                        lineHeight: "1.4",
                      }}
                    >
                      &ldquo;{rep.reason}&rdquo;
                    </p>
                  </td>
                  <td style={{ padding: "16px 8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "3px 6px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        backgroundColor: rep.resolved
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(234, 179, 8, 0.15)",
                        color: rep.resolved ? "#10b981" : "#eab308",
                      }}
                    >
                      {rep.resolved ? "RESOLVED" : "OPEN"}
                    </span>
                  </td>
                  <td style={{ padding: "16px 8px", textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "flex-end",
                        flexWrap: "wrap",
                      }}
                    >
                      {!isUser && rep.eventId && (
                        <button
                          type="button"
                          onClick={() => onInspectEvent(rep.id)}
                          style={smallButton}
                        >
                          Inspect event
                        </button>
                      )}
                      {isUser && targetEmail && (
                        <button
                          type="button"
                          onClick={() => onFindUser(targetEmail)}
                          style={smallButton}
                        >
                          Find in Users
                        </button>
                      )}
                      {!rep.resolved && !isUser && rep.eventId && (
                        <button
                          type="button"
                          onClick={() => onSuspendReportedEvent(rep.id)}
                          style={{
                            ...smallButton,
                            backgroundColor: "#b91c1c",
                            border: "none",
                            fontWeight: "bold",
                          }}
                        >
                          {rep.eventStatus === "SUSPENDED"
                            ? "Resolve (already suspended)"
                            : "Suspend drive & resolve"}
                        </button>
                      )}
                      {!rep.resolved && (
                        <button
                          type="button"
                          onClick={() => onDismissReport(rep.id)}
                          style={smallButton}
                        >
                          Dismiss Flag
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <LoadMoreButton hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  );
};
