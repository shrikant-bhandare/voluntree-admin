"use client";

import React from "react";
import { TabType } from "../../types";

interface HeaderProps {
  activeTab: TabType;
  isSyncing: boolean;
  lastSyncTime: string;
  /** Feeds that failed on the last sync, e.g. "Users (HTTP 429)". */
  syncErrors: string[];
  /** Outcome of the last moderation action that did not succeed. */
  actionError: string;
  onDismissActionError: () => void;
  onManualSync: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  isSyncing,
  lastSyncTime,
  syncErrors,
  actionError,
  onDismissActionError,
  onManualSync,
}) => {
  const degraded = syncErrors.length > 0;
  return (
    <header style={{ marginBottom: "36px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "white",
              margin: 0,
            }}
          >
            {activeTab === "dashboard" && "Console Overview"}
            {activeTab === "analytics" && "Impact Analytics"}
            {activeTab === "ngos" && "NGO Verifications"}
            {activeTab === "events" && "Campaign Moderation"}
            {activeTab === "moderation" && "Safety Operations"}
            {activeTab === "payments" && "Financial Dashboard"}
            {activeTab === "users" && "User Moderation Control"}
            {activeTab === "broadcast" && "System Broadcast Center"}
            {activeTab === "attendance" && "Volunteer Hours & Attendance Control"}
            {activeTab === "settings" && "Console Settings"}
          </h1>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "14px",
              margin: "4px 0 0 0",
            }}
          >
            {activeTab === "dashboard" &&
              "Monitor platform users, NGO compliance, and active drives."}
            {activeTab === "analytics" &&
              "Platform impact metrics, host leaderboard, and monthly volunteer hours."}
            {activeTab === "ngos" &&
              "Verify registrations and legal documentation for host organizations."}
            {activeTab === "events" &&
              "Oversee published volunteering drives and feature active campaigns."}
            {activeTab === "moderation" &&
              "Review spam alerts, fake events, or fraud reports submitted by users."}
            {activeTab === "payments" &&
              "Track premium host subscriptions and community donations."}
            {activeTab === "users" &&
              "Monitor volunteer contributions, manage organizer accounts, and ban or reinstate users."}
            {activeTab === "broadcast" &&
              "Compose and send push alerts and in-app notifications to the community."}
            {activeTab === "attendance" &&
              "Audit verified check-in/check-out sessions, logged hours, and certificates."}
            {activeTab === "settings" &&
              "Console-only preferences such as the live polling interval."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              border: `1px solid ${degraded ? "#ef4444" : "#334155"}`,
              padding: "8px 16px",
              borderRadius: "20px",
              backgroundColor: "#131a2c",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                height: "8px",
                width: "8px",
                borderRadius: "50%",
                backgroundColor: isSyncing
                  ? "#eab308"
                  : degraded
                  ? "#ef4444"
                  : "#10b981",
                boxShadow: isSyncing
                  ? "0 0 8px #eab308"
                  : degraded
                  ? "0 0 8px #ef4444"
                  : "0 0 8px #10b981",
              }}
            />
            Live Sync:{" "}
            <strong style={{ color: "white" }}>
              {isSyncing ? "SYNCING..." : degraded ? "DEGRADED" : "ACTIVE"}
            </strong>
            {lastSyncTime && (
              <span style={{ color: "#64748b", fontSize: "11px" }}>
                (last full sync {lastSyncTime})
              </span>
            )}
          </span>

          <button
            onClick={onManualSync}
            disabled={isSyncing}
            style={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              color: "white",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {degraded && (
        <div
          role="alert"
          style={{
            marginTop: "16px",
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid #ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            color: "#fca5a5",
            fontSize: "13px",
          }}
        >
          ⚠️ Some data could not be refreshed and may be stale:{" "}
          {syncErrors.join(", ")}.
          {syncErrors.some(e => e.includes("429")) &&
            " The API rate limit was hit — lower the polling frequency in Settings."}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          style={{
            marginTop: "12px",
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid #f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            color: "#fcd34d",
            fontSize: "13px",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <span>⚠️ {actionError}</span>
          <button
            onClick={onDismissActionError}
            style={{
              background: "none",
              border: "none",
              color: "#fcd34d",
              cursor: "pointer",
              fontWeight: "bold",
            }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </header>
  );
};
