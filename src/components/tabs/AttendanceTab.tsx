"use client";

import React from "react";
import { AttendanceLog } from "../../types";
import { exportToCsv } from "../../utils/csvExporter";
import { API_BASE_URL } from "../../config/constants";

interface AttendanceTabProps {
  attendanceLogs: AttendanceLog[];
  token: string | null;
}

/**
 * The certificate route requires a Bearer token, which a plain anchor cannot
 * send — every click used to open a tab showing a 401. Fetch with the header
 * and hand the browser a blob instead.
 */
async function downloadCertificate(token: string, attendanceId: string) {
  try {
    const res = await fetch(
      `${API_BASE_URL}/attendance/certificate/${attendanceId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      alert(`Could not download the certificate (HTTP ${res.status}).`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `certificate-${attendanceId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    alert("Could not download the certificate — network error.");
  }
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  attendanceLogs,
  token,
}) => {
  return (
    <div
      style={{
        backgroundColor: "rgba(30, 41, 59, 0.45)",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "28px",
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
            color: "white",
            fontWeight: "bold",
            margin: 0,
          }}
        >
          Volunteer Hours & Attendance Log
        </h3>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            onClick={() =>
              exportToCsv(
                "attendance_hours_log",
                [
                  "Volunteer",
                  "Email",
                  "Event",
                  "Category",
                  "CheckIn",
                  "CheckOut",
                  "HoursLogged",
                  "Status",
                ],
                attendanceLogs.map(a => [
                  a.volunteer?.fullName || "—",
                  a.volunteer?.email || "—",
                  a.event?.title || "—",
                  a.event?.category || "—",
                  new Date(a.checkIn).toLocaleString(),
                  a.checkOut
                    ? new Date(a.checkOut).toLocaleString()
                    : "ACTIVE",
                  a.hoursLogged || 0,
                  a.verifiedByOrganizer ? "VERIFIED" : "PENDING",
                ])
              )
            }
            style={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              color: "white",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            📥 Export Attendance CSV
          </button>
          <div
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "12px",
              color: "#10b981",
              fontWeight: "bold",
            }}
          >
            Total Sessions: {attendanceLogs.length}
          </div>
        </div>
      </div>

      {attendanceLogs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            No attendance sessions logged yet.
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
                Volunteer
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Event Drive
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Check-In
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Check-Out
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Hours Logged
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
                Certificate
              </th>
            </tr>
          </thead>
          <tbody>
            {attendanceLogs.map((log: any) => (
              <tr key={log.id} style={{ borderBottom: "1px solid #1e293b" }}>
                <td style={{ padding: "14px 8px" }}>
                  <div style={{ fontWeight: "bold" }}>
                    {log.volunteer?.fullName || "Platform Volunteer"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                    {log.volunteer?.email}
                  </div>
                </td>
                <td style={{ padding: "14px 8px" }}>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>
                    {log.event?.title || "Volunteer Drive"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                    {log.event?.category}
                  </div>
                </td>
                <td
                  style={{
                    padding: "14px 8px",
                    fontSize: "12px",
                    color: "#94a3b8",
                  }}
                >
                  {new Date(log.checkIn).toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "14px 8px",
                    fontSize: "12px",
                    color: "#94a3b8",
                  }}
                >
                  {log.checkOut
                    ? new Date(log.checkOut).toLocaleString()
                    : "Session Active"}
                </td>
                <td
                  style={{
                    padding: "14px 8px",
                    fontWeight: "bold",
                    color: "#10b981",
                  }}
                >
                  {log.hoursLogged ? `${log.hoursLogged} hrs` : "In Progress"}
                </td>
                <td style={{ padding: "14px 8px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "3px 6px",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      backgroundColor: log.verifiedByOrganizer
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(234, 179, 8, 0.15)",
                      color: log.verifiedByOrganizer ? "#10b981" : "#eab308",
                    }}
                  >
                    {log.verifiedByOrganizer ? "VERIFIED" : "PENDING"}
                  </span>
                </td>
                <td style={{ padding: "14px 8px", textAlign: "right" }}>
                  {log.checkOut ? (
                    <button
                      onClick={() => token && downloadCertificate(token, log.id)}
                      style={{
                        color: "#6366f1",
                        fontSize: "12px",
                        textDecoration: "underline",
                        fontWeight: "bold",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      📄 Download PDF
                    </button>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      N/A
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
