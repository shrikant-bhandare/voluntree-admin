"use client";

import React from "react";

interface SettingsTabProps {
  autoSyncSeconds: number;
  setAutoSyncSeconds: (val: number) => void;
}

/**
 * Only preferences that actually take effect live here. The previous
 * "announcement banner" and "maintenance mode" controls were React state with
 * no backend behind them, yet told the admin they had been saved platform-wide.
 */
export const SettingsTab: React.FC<SettingsTabProps> = ({
  autoSyncSeconds,
  setAutoSyncSeconds,
}) => {
  return (
    <div
      style={{
        backgroundColor: "rgba(30, 41, 59, 0.45)",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "28px",
        maxWidth: "680px",
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
        Console Preferences
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              color: "#94a3b8",
              marginBottom: "8px",
              fontWeight: "600",
            }}
          >
            Live data polling interval
          </label>
          <select
            value={autoSyncSeconds}
            onChange={e => setAutoSyncSeconds(Number(e.target.value))}
            style={{
              width: "100%",
              backgroundColor: "#0b0f19",
              border: "1px solid #334155",
              color: "white",
              padding: "12px 14px",
              borderRadius: "10px",
              fontSize: "14px",
              outline: "none",
            }}
          >
            <option value={10}>10 seconds (recommended)</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds (low traffic)</option>
          </select>
          <p
            style={{
              fontSize: "11px",
              color: "#64748b",
              marginTop: "6px",
            }}
          >
            Each refresh issues eight API requests. The API allows 120 requests
            per minute per client, so intervals under 10 seconds (or several
            open console tabs) are rate limited and the data goes stale.
          </p>
        </div>

        <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
          These preferences apply to this browser session only.
        </p>
      </div>
    </div>
  );
};
