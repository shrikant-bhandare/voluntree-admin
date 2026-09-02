"use client";

import React, { useState, useMemo } from "react";
import { EventItem, LIST_PAGE_SIZE } from "../../types";
import { exportToCsv } from "../../utils/csvExporter";
import { ALL_EVENT_STATUSES, nextAdminStatus } from "../../utils/eventStatus";

interface EventsTabProps {
  events: EventItem[];
  /** Exact count from /admin/stats; the list itself is one page. */
  totalOnPlatform?: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectEvent: (event: EventItem) => void;
  onToggleStatus: (id: string) => void;
}

export const EventsTab: React.FC<EventsTabProps> = ({
  events,
  totalOnPlatform,
  searchQuery,
  setSearchQuery,
  onSelectEvent,
  onToggleStatus,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Summary Metrics (over the loaded page)
  const totalCampaigns = totalOnPlatform ?? events.length;
  const truncated =
    typeof totalOnPlatform === "number" && totalOnPlatform > events.length;
  const activeCount = events.filter(e => e.status === "ACTIVE").length;
  const featuredCount = events.filter(e => e.status === "FEATURED").length;
  const totalEnrolled = events.reduce((sum, e) => sum + (e.approvedCount || 0), 0);
  const totalHours =
    Math.round(events.reduce((sum, e) => sum + (e.hoursLoggedTotal || 0), 0) * 10) / 10;

  // Available Categories
  const categoriesList = useMemo(() => {
    const cats = new Set(events.map(e => e.category).filter(Boolean));
    return ["ALL", ...Array.from(cats)];
  }, [events]);

  // Filtered Events List
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      const matchesSearch =
        evt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.organizer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "ALL" || evt.category === selectedCategory;
      const matchesStatus =
        selectedStatus === "ALL" || evt.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [events, searchQuery, selectedCategory, selectedStatus]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Monitoring Summary Cards Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>
            Total Campaigns
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              color: "white",
              marginTop: "4px",
            }}
          >
            {totalCampaigns}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>
            Active Drives
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              color: "#10b981",
              marginTop: "4px",
            }}
          >
            {activeCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>
            Featured Drives
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              color: "#eab308",
              marginTop: "4px",
            }}
          >
            {featuredCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>
            Approved Volunteers (loaded drives)
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              color: "#6366f1",
              marginTop: "4px",
            }}
          >
            {totalEnrolled}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            border: "1px solid #334155",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>
            Logged Impact Hours
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              color: "#ec4899",
              marginTop: "4px",
            }}
          >
            {totalHours} hrs
          </div>
        </div>
      </div>

      {/* Main Events Table Panel */}
      <div
        style={{
          backgroundColor: "rgba(30, 41, 59, 0.45)",
          border: "1px solid #334155",
          borderRadius: "16px",
          padding: "28px",
        }}
      >
        {/* Header Control Filters & Export */}
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
          <div>
            <h3
              style={{
                fontSize: "18px",
                color: "white",
                fontWeight: "bold",
                margin: 0,
              }}
            >
              Campaign Moderation & Event Drive Roster
            </h3>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
              Showing {filteredEvents.length} of {events.length} loaded drives
              {truncated &&
                ` (newest ${LIST_PAGE_SIZE} of ${totalOnPlatform} on the platform)`}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{
                backgroundColor: "#0b0f19",
                border: "1px solid #334155",
                color: "white",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                outline: "none",
              }}
            >
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>
                  {cat === "ALL" ? "All Categories" : cat}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              style={{
                backgroundColor: "#0b0f19",
                border: "1px solid #334155",
                color: "white",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                outline: "none",
              }}
            >
              <option value="ALL">All Statuses</option>
              {ALL_EVENT_STATUSES.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search title, host, venue..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                backgroundColor: "#0b0f19",
                border: "1px solid #334155",
                color: "white",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                width: "200px",
                outline: "none",
              }}
            />

            {/* Export CSV Button */}
            <button
              onClick={() =>
                exportToCsv(
                  "campaigns_monitoring_report",
                  [
                    "ID",
                    "Title",
                    "Organizer",
                    "OrganizerVerified",
                    "Category",
                    "Location",
                    "Applications",
                    "ApprovedVolunteers",
                    "VolunteersNeeded",
                    "HoursLoggedTotal",
                    "OpenSafetyFlags",
                    "Status",
                  ],
                  // Export what is on screen, matching the "Showing X of Y" label.
                  filteredEvents.map(e => [
                    e.id,
                    e.name,
                    e.organizer,
                    e.isOrganizerVerified ? "yes" : "no",
                    e.category,
                    e.location,
                    e.volunteersApplied,
                    e.approvedCount,
                    e.volunteersNeeded,
                    e.hoursLoggedTotal || 0,
                    e.reportsCount || 0,
                    e.status,
                  ])
                )
              }
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                color: "white",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
              No volunteer drives match the selected search & filter criteria.
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
                  Event Drive & Host
                </th>
                <th
                  style={{
                    padding: "12px 8px",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  Category & Type
                </th>
                <th
                  style={{
                    padding: "12px 8px",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  Location
                </th>
                <th
                  style={{
                    padding: "12px 8px",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  Approved / Slots
                </th>
                <th
                  style={{
                    padding: "12px 8px",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  Impact Hours
                </th>
                <th
                  style={{
                    padding: "12px 8px",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  Safety Flags
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
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map(evt => (
                <tr
                  key={evt.id}
                  style={{ borderBottom: "1px solid #1e293b" }}
                >
                  <td style={{ padding: "16px 8px" }}>
                    <div
                      onClick={() => onSelectEvent(evt)}
                      style={{
                        fontWeight: "bold",
                        cursor: "pointer",
                        color: "white",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#6366f1")}
                      onMouseLeave={e => (e.currentTarget.style.color = "white")}
                    >
                      {evt.name}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        marginTop: "4px",
                      }}
                    >
                      Host: {evt.organizer} ({evt.organizerEmail})
                    </div>
                  </td>
                  <td style={{ padding: "16px 8px", fontSize: "13px" }}>
                    <div>{evt.category}</div>
                    <span
                      style={{
                        fontSize: "10px",
                        color: evt.isPaid ? "#10b981" : "#94a3b8",
                        fontWeight: "bold",
                      }}
                    >
                      {evt.isPaid ? "💵 Stipend Drive" : "🌱 Free Community"}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "16px 8px",
                      fontSize: "13px",
                      color: "#94a3b8",
                      maxWidth: "160px",
                    }}
                  >
                    {evt.location}
                  </td>
                  <td style={{ padding: "16px 8px", fontSize: "13px" }}>
                    <strong style={{ color: "#6366f1" }}>
                      {evt.approvedCount}
                    </strong>{" "}
                    / {evt.volunteersNeeded} slots
                    <div style={{ fontSize: "10px", color: "#64748b" }}>
                      {evt.volunteersApplied} application
                      {evt.volunteersApplied === 1 ? "" : "s"}
                    </div>
                    <div
                      style={{
                        height: "4px",
                        width: "80px",
                        backgroundColor: "#334155",
                        borderRadius: "2px",
                        marginTop: "4px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(
                            100,
                            Math.round(
                              (evt.approvedCount /
                                (evt.volunteersNeeded || 1)) *
                                100
                            )
                          )}%`,
                          backgroundColor: "#6366f1",
                        }}
                      />
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "16px 8px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      color: "#10b981",
                    }}
                  >
                    {evt.hoursLoggedTotal ? `${evt.hoursLoggedTotal} hrs` : "0 hrs"}
                  </td>
                  <td style={{ padding: "16px 8px" }}>
                    {evt.reportsCount && evt.reportsCount > 0 ? (
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
                        ⚠️ {evt.reportsCount} Flagged
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        ✓ Clean
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "16px 8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "3px 6px",
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
                  </td>
                  <td style={{ padding: "16px 8px", textAlign: "right" }}>
                    <button
                      onClick={() => onSelectEvent(evt)}
                      style={{
                        backgroundColor: "#6366f1",
                        border: "none",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "600",
                        marginRight: "8px",
                      }}
                    >
                      👁️ Inspect
                    </button>
                    {(() => {
                      const transition = nextAdminStatus(evt.status);
                      return transition ? (
                        <button
                          onClick={() => onToggleStatus(evt.id)}
                          style={{
                            backgroundColor: "#1e293b",
                            border: `1px solid ${transition.destructive ? "#ef4444" : "#334155"}`,
                            color: transition.destructive ? "#fca5a5" : "white",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "500",
                          }}
                        >
                          {transition.label}
                        </button>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          No admin action
                        </span>
                      );
                    })()}
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
