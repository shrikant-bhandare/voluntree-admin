"use client";

import React, { useMemo } from "react";
import {
  AdminStats,
  AttendanceLog,
  EventItem,
  NGO,
  PaymentTransaction,
} from "../../types";
import { formatMoney } from "../../utils/format";
import { exportToCsv } from "../../utils/csvExporter";

interface AnalyticsTabProps {
  events: EventItem[];
  attendanceLogs: AttendanceLog[];
  ngos: NGO[];
  transactions: PaymentTransaction[];
  /** Exact platform-wide counts; null until the first sync succeeds. */
  stats: AdminStats | null;
}

const card: React.CSSProperties = {
  backgroundColor: "rgba(30, 41, 59, 0.45)",
  border: "1px solid #334155",
  borderRadius: "16px",
  padding: "24px",
};
const label: React.CSSProperties = {
  fontSize: "12px",
  color: "#94a3b8",
  fontWeight: "600",
  textTransform: "uppercase",
};

/**
 * Everything on this tab is computed from real data or shown as "not enough
 * data". The previous version padded empty datasets with invented hosts,
 * a 340-hour floor, a fixed Feb–Jul axis and a constant 78.4% retention.
 */
export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  events,
  attendanceLogs,
  transactions,
  stats,
}) => {
  // Exact totals from the API when available; otherwise the loaded page.
  const totalImpactHours = useMemo(() => {
    if (stats) return stats.attendance.totalHours;
    return attendanceLogs.reduce((acc, log) => acc + (log.hoursLogged || 0), 0);
  }, [attendanceLogs, stats]);

  const totalRevenue = useMemo(() => {
    if (stats) return stats.payments.revenue;
    return transactions
      .filter(t => t.status === "SUCCESS")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, stats]);

  // Leaderboard keyed by organizer id, not display name, so two hosts with
  // the same name are not merged.
  const ngoLeaderboard = useMemo(() => {
    const hostMap: Record<
      string,
      {
        name: string;
        verified: boolean;
        drivesCount: number;
        volunteersApproved: number;
        hours: number;
      }
    > = {};

    events.forEach(evt => {
      const key = evt.organizerId || `name:${evt.organizer}`;
      if (!hostMap[key]) {
        hostMap[key] = {
          name: evt.organizer || "Host Organization",
          verified: Boolean(evt.isOrganizerVerified),
          drivesCount: 0,
          volunteersApproved: 0,
          hours: 0,
        };
      }
      hostMap[key].drivesCount += 1;
      hostMap[key].volunteersApproved += evt.approvedCount || 0;
      hostMap[key].hours += evt.hoursLoggedTotal || 0;
    });

    return Object.values(hostMap).sort(
      (a, b) =>
        b.volunteersApproved - a.volunteersApproved ||
        b.drivesCount - a.drivesCount
    );
  }, [events]);

  const categoryImpact = useMemo(() => {
    const catCounts: Record<string, { count: number; hours: number }> = {};
    events.forEach(evt => {
      const cat = evt.category || "General";
      if (!catCounts[cat]) catCounts[cat] = { count: 0, hours: 0 };
      catCounts[cat].count += 1;
      catCounts[cat].hours += evt.hoursLoggedTotal || 0;
    });
    const total =
      Object.values(catCounts).reduce((acc, curr) => acc + curr.count, 0) || 1;
    return Object.entries(catCounts)
      .map(([category, data]) => ({
        category,
        count: data.count,
        hours: Math.round(data.hours * 10) / 10,
        percentage: Math.round((data.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  // Last six calendar months ending this month, from real check-outs only.
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; month: string; hours: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: d.toLocaleString("en-US", { month: "short" }),
        hours: 0,
      });
    }
    attendanceLogs.forEach(log => {
      if (!log.checkOut || !log.checkIn) return;
      const d = new Date(log.checkIn);
      const bucket = buckets.find(
        b => b.key === `${d.getFullYear()}-${d.getMonth()}`
      );
      if (bucket) bucket.hours += log.hoursLogged || 0;
    });
    return buckets.map(b => ({ ...b, hours: Math.round(b.hours * 10) / 10 }));
  }, [attendanceLogs]);

  const maxMonthlyHours = Math.max(...monthlyTrend.map(m => m.hours), 0);
  const hasTrendData = maxMonthlyHours > 0;
  const topHost = ngoLeaderboard[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "24px",
        }}
      >
        <div style={card}>
          <span style={label}>Total Impact Hours</span>
          <h3
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "white",
              margin: "12px 0 0 0",
            }}
          >
            {totalImpactHours.toLocaleString()} hrs
          </h3>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            {stats
              ? `${stats.attendance.completedSessions.toLocaleString()} completed sessions`
              : "From loaded attendance logs"}
          </span>
        </div>

        <div style={card}>
          <span style={label}>Top Host NGO</span>
          <h3
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "white",
              margin: "12px 0 0 0",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {topHost ? topHost.name : "—"}
          </h3>
          <span style={{ fontSize: "11px", color: "#6366f1", fontWeight: "bold" }}>
            {topHost
              ? `${topHost.volunteersApproved} approved volunteers across ${topHost.drivesCount} drive(s)`
              : "No events yet"}
          </span>
        </div>

        <div style={card}>
          <span style={label}>Active Drives</span>
          <h3
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "white",
              margin: "12px 0 0 0",
            }}
          >
            {stats ? stats.events.active : events.filter(e => e.status === "ACTIVE" || e.status === "FEATURED").length}
          </h3>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            {stats
              ? `${stats.events.upcoming} upcoming · ${stats.events.suspended} suspended`
              : "From loaded events"}
          </span>
        </div>

        <div style={card}>
          <span style={label}>Revenue Settled</span>
          <h3
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "#10b981",
              margin: "12px 0 0 0",
            }}
          >
            {formatMoney(totalRevenue, "INR")}
          </h3>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            Successful donations, subscriptions & featured fees
          </span>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "28px" }}>
        <div style={{ ...card, padding: "28px", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <div>
              <h3 style={{ fontSize: "18px", color: "white", fontWeight: "bold", margin: 0 }}>
                Monthly Volunteer Hours
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "12px", margin: "4px 0 0 0" }}>
                Hours from completed check-outs in the last 6 calendar months
                (loaded attendance logs)
              </p>
            </div>
            <button
              onClick={() =>
                exportToCsv(
                  "monthly_hours_analytics",
                  ["Month", "HoursLogged"],
                  monthlyTrend.map(m => [m.month, m.hours])
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
              📥 Export CSV
            </button>
          </div>

          {hasTrendData ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "space-around",
                alignItems: "flex-end",
                padding: "20px 10px 10px",
                minHeight: "220px",
                borderBottom: "1px solid #334155",
              }}
            >
              {monthlyTrend.map(item => {
                const height = Math.max(
                  4,
                  Math.round((item.hours / maxMonthlyHours) * 160)
                );
                const isPeak = item.hours === maxMonthlyHours;
                return (
                  <div
                    key={item.key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        color: isPeak ? "#10b981" : "#6366f1",
                        fontWeight: "bold",
                      }}
                    >
                      {item.hours}h
                    </span>
                    <div
                      style={{
                        height: `${height}px`,
                        width: "42px",
                        borderRadius: "8px 8px 2px 2px",
                        background: isPeak
                          ? "linear-gradient(to top, #10b981, #6366f1)"
                          : "linear-gradient(to top, #6366f1, #818cf8)",
                        transition: "height 0.4s ease",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "12px",
                        color: isPeak ? "white" : "#94a3b8",
                        fontWeight: isPeak ? "bold" : "normal",
                      }}
                    >
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                minHeight: "220px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              No completed check-outs in the last six months yet.
            </div>
          )}
        </div>

        <div style={{ ...card, padding: "28px" }}>
          <h3 style={{ fontSize: "18px", color: "white", fontWeight: "bold", margin: "0 0 6px 0" }}>
            Category Distribution
          </h3>
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 24px 0" }}>
            Share of loaded drives by category, with logged hours
          </p>
          {categoryImpact.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "13px" }}>No events yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {categoryImpact.map(item => (
                <div key={item.category}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ color: "white", fontWeight: "600" }}>{item.category}</span>
                    <span style={{ color: "#94a3b8" }}>
                      {item.count} drives ({item.percentage}%) · {item.hours}h
                    </span>
                  </div>
                  <div
                    style={{
                      height: "8px",
                      width: "100%",
                      backgroundColor: "#0b0f19",
                      borderRadius: "4px",
                      overflow: "hidden",
                      border: "1px solid #1e293b",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${item.percentage}%`,
                        background: "linear-gradient(to right, #6366f1, #ec4899)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ ...card, padding: "28px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "18px", color: "white", fontWeight: "bold", margin: 0 }}>
              Host Organizations Leaderboard
            </h3>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
              Ranked by approved volunteers, then drives hosted (loaded events)
            </p>
          </div>
          <button
            onClick={() =>
              exportToCsv(
                "ngo_leaderboard_analytics",
                ["Rank", "Host Organization", "Verified", "Drives Hosted", "Volunteers Approved", "Hours Logged"],
                ngoLeaderboard.map((n, i) => [
                  i + 1,
                  n.name,
                  n.verified ? "yes" : "no",
                  n.drivesCount,
                  n.volunteersApproved,
                  n.hours,
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
            📥 Export Leaderboard CSV
          </button>
        </div>

        {ngoLeaderboard.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
            No host organizations have published events yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", color: "white" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", textAlign: "left" }}>
                {["Rank", "Host Organization", "Drives Hosted", "Volunteers Approved", "Hours Logged", "Verification"].map(h => (
                  <th key={h} style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ngoLeaderboard.map((ngo, idx) => (
                <tr key={`${ngo.name}-${idx}`} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td
                    style={{
                      padding: "14px 8px",
                      fontWeight: "bold",
                      color: idx === 0 ? "#eab308" : idx === 1 ? "#cbd5e1" : idx === 2 ? "#d97706" : "#94a3b8",
                    }}
                  >
                    #{idx + 1}
                  </td>
                  <td style={{ padding: "14px 8px", fontWeight: "bold" }}>{ngo.name}</td>
                  <td style={{ padding: "14px 8px", color: "#6366f1", fontWeight: "bold" }}>{ngo.drivesCount}</td>
                  <td style={{ padding: "14px 8px", color: "#10b981", fontWeight: "bold" }}>{ngo.volunteersApproved}</td>
                  <td style={{ padding: "14px 8px", color: "#ec4899", fontWeight: "bold" }}>{ngo.hours} h</td>
                  <td style={{ padding: "14px 8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "3px 7px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        backgroundColor: ngo.verified ? "rgba(16,185,129,0.15)" : "rgba(234,179,8,0.15)",
                        color: ngo.verified ? "#10b981" : "#eab308",
                      }}
                    >
                      {ngo.verified ? "✓ VERIFIED HOST" : "UNVERIFIED"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
