"use client";

import React from "react";
import { PlatformUser } from "../../types";
import { exportToCsv } from "../../utils/csvExporter";

interface UsersTabProps {
  usersList: PlatformUser[];
  /** Exact count from /admin/stats; usersList is only the newest page. */
  totalRegistered?: number;
  adminUser: any;
  onToggleUserBan: (id: string, currentBanStatus: boolean) => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({
  usersList,
  totalRegistered,
  adminUser,
  onToggleUserBan,
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
          Volunteer & Organizer Control
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() =>
              exportToCsv(
                "users_roster",
                [
                  "ID",
                  "Name",
                  "Email",
                  "Phone",
                  "UserType",
                  "Status",
                  "JoinedDate",
                ],
                usersList.map(u => [
                  u.id,
                  u.fullName,
                  u.email,
                  u.phoneNumber || "",
                  u.userType,
                  u.isBanned ? "SUSPENDED" : "ACTIVE",
                  u.createdAt,
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
            📥 Export Users CSV
          </button>
          <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
            {typeof totalRegistered === "number" && totalRegistered > usersList.length ? (
              <>
                Showing newest <strong>{usersList.length}</strong> of{" "}
                <strong>{totalRegistered}</strong> registered
              </>
            ) : (
              <>
                Total Registered: <strong>{totalRegistered ?? usersList.length}</strong>
              </>
            )}
          </span>
        </div>
      </div>

      {usersList.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            No users found on the platform.
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
                Name / Email
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Phone
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Account Type
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Reputation
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Joined Date
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
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {usersList.map(user => {
              const isSelf = adminUser && adminUser.id === user.id;
              return (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: "1px solid #1e293b",
                    opacity: user.isBanned ? 0.6 : 1,
                  }}
                >
                  <td style={{ padding: "14px 8px" }}>
                    <div style={{ fontWeight: "bold" }}>{user.fullName}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {user.email}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "14px 8px",
                      color: "#94a3b8",
                      fontSize: "13px",
                    }}
                  >
                    {user.phoneNumber ?? "—"}
                  </td>
                  <td style={{ padding: "14px 8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "3px 7px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        backgroundColor:
                          user.userType === "ADMIN"
                            ? "rgba(236,72,153,0.15)"
                            : user.userType === "ORGANIZER"
                            ? "rgba(16,185,129,0.15)"
                            : "rgba(99,102,241,0.15)",
                        color:
                          user.userType === "ADMIN"
                            ? "#ec4899"
                            : user.userType === "ORGANIZER"
                            ? "#10b981"
                            : "#6366f1",
                      }}
                    >
                      {user.userType}
                    </span>
                  </td>
                  <td style={{ padding: "14px 8px", fontSize: "13px" }}>
                    {user.userType === "VOLUNTEER" && user.profile ? (
                      <div style={{ color: "#eab308", fontWeight: "bold" }}>
                        {user.profile.reputationLevel} (
                        {user.profile.reputationScore} pts)
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    style={{
                      padding: "14px 8px",
                      color: "#64748b",
                      fontSize: "12px",
                    }}
                  >
                    {user.createdAt}
                  </td>
                  <td style={{ padding: "14px 8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "3px 7px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        backgroundColor: user.isBanned
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(16,185,129,0.15)",
                        color: user.isBanned ? "#ef4444" : "#10b981",
                      }}
                    >
                      {user.isBanned ? "SUSPENDED" : "ACTIVE"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 8px", textAlign: "right" }}>
                    {!isSelf && user.userType !== "ADMIN" ? (
                      <button
                        onClick={() =>
                          onToggleUserBan(user.id, user.isBanned)
                        }
                        style={{
                          backgroundColor: user.isBanned
                            ? "rgba(16,185,129,0.15)"
                            : "rgba(239,68,68,0.15)",
                          border: `1px solid ${
                            user.isBanned ? "#10b981" : "#ef4444"
                          }`,
                          color: user.isBanned ? "#10b981" : "#ef4444",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600",
                          transition: "all 0.2s",
                        }}
                      >
                        {user.isBanned ? "Reactivate" : "Suspend Account"}
                      </button>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#475569" }}>
                        No Actions
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
