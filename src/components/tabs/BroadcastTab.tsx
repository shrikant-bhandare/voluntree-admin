"use client";

import React from "react";
import { BroadcastNotification } from "../../types";

interface BroadcastTabProps {
  broadcastTitle: string;
  setBroadcastTitle: (val: string) => void;
  broadcastBody: string;
  setBroadcastBody: (val: string) => void;
  broadcastTargetRole: "ALL" | "VOLUNTEER" | "ORGANIZER";
  setBroadcastTargetRole: (role: "ALL" | "VOLUNTEER" | "ORGANIZER") => void;
  /** Upper bound of recipients for the selected role, from /admin/stats. */
  audienceCount: number | null;
  isBroadcasting: boolean;
  broadcastMsg: string;
  broadcastHistory: BroadcastNotification[];
  historyHasMore: boolean;
  /** Set when the history feed has never loaded (e.g. "HTTP 500"). */
  historyError: string | null;
  onRetryHistory: () => void;
  onSendBroadcast: (e: React.FormEvent) => void;
}

export const BroadcastTab: React.FC<BroadcastTabProps> = ({
  broadcastTitle,
  setBroadcastTitle,
  broadcastBody,
  setBroadcastBody,
  broadcastTargetRole,
  setBroadcastTargetRole,
  audienceCount,
  isBroadcasting,
  broadcastMsg,
  broadcastHistory,
  historyHasMore,
  historyError,
  onRetryHistory,
  onSendBroadcast,
}) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "28px",
      }}
    >
      {/* Compose Broadcast */}
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
          Compose System Broadcast
        </h3>

        {broadcastMsg && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "500",
              marginBottom: "20px",
              backgroundColor: broadcastMsg.startsWith("✓")
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
              color: broadcastMsg.startsWith("✓") ? "#10b981" : "#ef4444",
            }}
          >
            {broadcastMsg}
          </div>
        )}

        <form
          onSubmit={onSendBroadcast}
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              Target Role Audience
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              {(["ALL", "VOLUNTEER", "ORGANIZER"] as const).map(role => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={broadcastTargetRole === role}
                  onClick={() => setBroadcastTargetRole(role)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${
                      broadcastTargetRole === role ? "#6366f1" : "#334155"
                    }`,
                    backgroundColor:
                      broadcastTargetRole === role
                        ? "rgba(99, 102, 241, 0.2)"
                        : "#0b0f19",
                    color: broadcastTargetRole === role ? "white" : "#94a3b8",
                    fontSize: "12px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {role === "ALL"
                    ? "🌐 All Users"
                    : role === "VOLUNTEER"
                    ? "🙋 Volunteers"
                    : "🏢 Organizers"}
                </button>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "8px 0 0 0" }}>
              Audience:{" "}
              {audienceCount === null
                ? "unknown (stats unavailable)"
                : `up to ${audienceCount.toLocaleString("en-IN")} accounts`}{" "}
              — banned accounts are excluded. You will be asked to confirm.
            </p>
          </div>

          <div>
            <label
              htmlFor="broadcast-title"
              style={{
                display: "block",
                fontSize: "13px",
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              Notification Title
            </label>
            <input
              id="broadcast-title"
              type="text"
              required
              minLength={3}
              maxLength={120}
              placeholder="e.g. Urgent Community Relief Drive Update 📢"
              value={broadcastTitle}
              onChange={e => setBroadcastTitle(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: "#0b0f19",
                border: "1px solid #334155",
                color: "white",
                padding: "12px 14px",
                borderRadius: "10px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="broadcast-body"
              style={{
                display: "block",
                fontSize: "13px",
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              Notification Message Body
            </label>
            <textarea
              id="broadcast-body"
              required
              minLength={3}
              maxLength={500}
              rows={4}
              placeholder="Provide details about the update or alert..."
              value={broadcastBody}
              onChange={e => setBroadcastBody(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: "#0b0f19",
                border: "1px solid #334155",
                color: "white",
                padding: "12px 14px",
                borderRadius: "10px",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isBroadcasting}
            style={{
              backgroundColor: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: "10px",
              padding: "14px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: isBroadcasting ? "wait" : "pointer",
              opacity: isBroadcasting ? 0.6 : 1,
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
            }}
          >
            {isBroadcasting
              ? "Dispatching Broadcast..."
              : "🚀 Dispatch System Broadcast"}
          </button>
        </form>
      </div>

      {/* Broadcast History */}
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
          Sent Notifications Log
        </h3>
        {historyHasMore && (
          <p style={{ fontSize: "12px", color: "#fbbf24", margin: "-12px 0 16px 0" }}>
            Showing the newest {broadcastHistory.length} broadcasts.
          </p>
        )}

        {historyError && broadcastHistory.length === 0 ? (
          <div role="alert" style={{ textAlign: "center", padding: "40px 0", color: "#fca5a5", fontSize: "14px" }}>
            Could not load the broadcast history ({historyError}).{" "}
            <button
              type="button"
              onClick={onRetryHistory}
              style={{
                marginLeft: "6px",
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                color: "white",
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        ) : broadcastHistory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
              No system broadcasts sent yet.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              maxHeight: "480px",
              overflowY: "auto",
            }}
          >
            {broadcastHistory.map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  backgroundColor: "#0b0f19",
                  border: "1px solid #1e293b",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "14px",
                      color: "white",
                      fontWeight: "bold",
                      margin: 0,
                    }}
                  >
                    {item.title}
                  </h4>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#6366f1",
                      backgroundColor: "rgba(99, 102, 241, 0.15)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: "bold",
                    }}
                  >
                    {item.targetRole || "ALL"}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    margin: 0,
                    lineHeight: "1.4",
                  }}
                >
                  {item.body}
                </p>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#64748b",
                    marginTop: "8px",
                  }}
                >
                  Sent by: {item.sentBy?.fullName || "Platform Admin"} (
                  {new Date(item.createdAt).toLocaleString()})
                  {" · "}
                  {typeof item.recipientCount === "number"
                    ? `${item.recipientCount.toLocaleString("en-IN")} recipient${item.recipientCount === 1 ? "" : "s"}`
                    : "recipient count not recorded"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
