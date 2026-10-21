"use client";

import React from "react";
import { EventItem, TabType } from "../../types";

interface OverviewTabProps {
  totalVolunteersCount: number;
  activeHostsCount: number;
  activeEventsCount: number;
  pendingNgosCount: number;
  events: EventItem[];
  categoryDistribution: { label: string; count: number; isPrimary?: boolean }[];
  maxCategoryCount: number;
  onSelectEvent: (event: EventItem) => void;
  setActiveTab: (tab: TabType) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  totalVolunteersCount,
  activeHostsCount,
  activeEventsCount,
  pendingNgosCount,
  events,
  categoryDistribution,
  maxCategoryCount,
  onSelectEvent,
  setActiveTab,
}) => {
  return (
    <div>
      {/* Dynamic Key Metric Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "24px",
          marginBottom: "36px",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "24px",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              fontWeight: "600",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Total Registered Users
          </p>
          <h3
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "white",
              margin: "8px 0 0 0",
            }}
          >
            {totalVolunteersCount}
          </h3>
          <span
            style={{
              fontSize: "11px",
              color: "#6366f1",
              fontWeight: "600",
              display: "inline-block",
              marginTop: "4px",
            }}
          >
            Registered users
          </span>
        </div>

        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "24px",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              fontWeight: "600",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Active Drive Hosts
          </p>
          <h3
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "white",
              margin: "8px 0 0 0",
            }}
          >
            {activeHostsCount}
          </h3>
          <span
            style={{
              fontSize: "11px",
              color: "#10b981",
              fontWeight: "600",
              display: "inline-block",
              marginTop: "4px",
            }}
          >
            Organizer accounts
          </span>
        </div>

        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "24px",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              fontWeight: "600",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Ongoing Campaigns
          </p>
          <h3
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "white",
              margin: "8px 0 0 0",
            }}
          >
            {activeEventsCount}
          </h3>
          <span
            style={{
              fontSize: "11px",
              color: "#94a3b8",
              display: "inline-block",
              marginTop: "4px",
            }}
          >
            Synced in real-time
          </span>
        </div>

        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "24px",
            borderLeft:
              pendingNgosCount > 0
                ? "3px solid #ec4899"
                : "1px solid #334155",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              fontWeight: "600",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Pending Verifications
          </p>
          <h3
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "white",
              margin: "8px 0 0 0",
            }}
          >
            {pendingNgosCount}
          </h3>
          <span
            style={{
              fontSize: "11px",
              color: pendingNgosCount > 0 ? "#ec4899" : "#94a3b8",
              fontWeight: "600",
              display: "inline-block",
              marginTop: "4px",
            }}
          >
            {pendingNgosCount > 0
              ? "⚠️ Requires review"
              : "✓ Compliance clear"}
          </span>
        </div>
      </div>

      {/* Main Content Grid Split */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3fr 2fr",
          gap: "28px",
        }}
      >
        {/* Published Campaigns Summary */}
        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "28px",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              color: "white",
              fontWeight: "bold",
              margin: "0 0 20px 0",
            }}
          >
            Published Volunteer Campaigns
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {events.slice(0, 3).map(evt => (
              <div
                key={evt.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #1e293b",
                  paddingBottom: "16px",
                }}
              >
                <div
                  onClick={() => onSelectEvent(evt)}
                  style={{ cursor: "pointer" }}
                >
                  <p
                    style={{
                      fontWeight: "bold",
                      color: "white",
                      margin: 0,
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={e =>
                      (e.currentTarget.style.color = "#6366f1")
                    }
                    onMouseLeave={e =>
                      (e.currentTarget.style.color = "white")
                    }
                  >
                    {evt.name}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#94a3b8",
                      marginTop: "4px",
                      margin: "4px 0 0 0",
                    }}
                  >
                    Host: <strong>{evt.organizer}</strong> | {evt.category} |{" "}
                    {evt.location}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <button
                    onClick={() => onSelectEvent(evt)}
                    style={{
                      backgroundColor: "rgba(99,102,241,0.15)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      color: "#6366f1",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  >
                    👁️ Details
                  </button>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      backgroundColor:
                        evt.status === "FEATURED"
                          ? "rgba(234, 179, 8, 0.15)"
                          : evt.status === "ACTIVE"
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(236, 72, 153, 0.15)",
                      color:
                        evt.status === "FEATURED"
                          ? "#eab308"
                          : evt.status === "ACTIVE"
                          ? "#10b981"
                          : "#ec4899",
                    }}
                  >
                    {evt.status}
                  </span>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                    {evt.approvedCount}/{evt.volunteersNeeded} slots
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setActiveTab("events")}
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: "#6366f1",
              fontWeight: "bold",
              marginTop: "20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: 0,
            }}
          >
            Manage all drives
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        {/* Dynamic Activity Breakdown Chart */}
        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
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
            Platform Activity Breakdown
          </h3>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "12px",
              margin: "4px 0 28px 0",
            }}
          >
            Live breakdown derived dynamically from real backend records.
          </p>

          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "space-around",
              alignItems: "flex-end",
              padding: "0 10px 10px",
              minHeight: "200px",
            }}
          >
            {categoryDistribution.map(item => {
              const height =
                maxCategoryCount > 0
                  ? Math.max(
                      30,
                      Math.round((item.count / maxCategoryCount) * 160)
                    )
                  : 30;
              return (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#6366f1",
                      fontWeight: "bold",
                    }}
                  >
                    {item.count}
                  </span>
                  <div
                    style={{
                      height: `${height}px`,
                      width: "38px",
                      borderRadius: "6px",
                      background: item.isPrimary
                        ? "linear-gradient(to top, #6366f1, #ec4899)"
                        : "#334155",
                      transition:
                        "height 0.4s ease, background 0.4s ease",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "11px",
                      color: item.isPrimary ? "white" : "#94a3b8",
                      fontWeight: item.isPrimary ? "bold" : "normal",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
