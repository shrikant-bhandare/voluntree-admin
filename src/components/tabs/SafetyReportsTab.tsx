"use client";

import React from "react";
import { SafetyReport } from "../../types";

interface SafetyReportsTabProps {
  reports: SafetyReport[];
  onResolveReport: (reportId: string) => void;
  onRemoveReportedEvent: (eventId: string, reportId: string) => void;
}

export const SafetyReportsTab: React.FC<SafetyReportsTabProps> = ({
  reports,
  onResolveReport,
  onRemoveReportedEvent,
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
        <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
          Unresolved Flagged Incidents:{" "}
          <strong>{reports.filter(r => !r.resolved).length}</strong>
        </span>
      </div>

      {reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            🛡️ Zero active safety violation flags reported by community users!
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
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Target Event
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Violation Type
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Reporter & Reason
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                  textAlign: "right",
                }}
              >
                Moderation Action
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map(rep => (
              <tr
                key={rep.id}
                style={{
                  borderBottom: "1px solid #1e293b",
                  opacity: rep.resolved ? 0.6 : 1.0,
                }}
              >
                <td style={{ padding: "16px 8px" }}>
                  <div style={{ fontWeight: "bold", color: "#f87171" }}>
                    {rep.eventName}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#94a3b8",
                      marginTop: "4px",
                    }}
                  >
                    Date: {rep.date}
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
                    {rep.resolved ? "RESOLVED" : "INVESTIGATING"}
                  </span>
                </td>
                <td style={{ padding: "16px 8px", textAlign: "right" }}>
                  {!rep.resolved ? (
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        onClick={() =>
                          onRemoveReportedEvent(rep.eventId, rep.id)
                        }
                        style={{
                          backgroundColor: "#ef4444",
                          border: "none",
                          color: "white",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        Purge Drive
                      </button>
                      <button
                        onClick={() => onResolveReport(rep.id)}
                        style={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          color: "white",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        Dismiss Flag
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Action Completed
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
