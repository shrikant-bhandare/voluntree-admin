"use client";

import React, { useState } from "react";
import { FeedHealth, NGO, NgoStatus } from "../../types";
import { API_BASE_URL } from "../../config/constants";
import { openDocument } from "../../utils/documents";
import { FeedError } from "../common/FeedStatus";

interface NgosTabProps {
  ngos: NGO[];
  token: string | null;
  status: NgoStatus;
  onStatusChange: (status: NgoStatus) => void;
  loadState: "loading" | "ready" | "error";
  health: FeedHealth;
  onRetry: () => void;
  onApproveNGO: (id: string) => void;
  onRejectNGO: (id: string) => void;
  onRevokeNGO: (id: string) => void;
  onSessionExpired: () => void;
}

const docButton: React.CSSProperties = {
  color: "#818cf8",
  fontSize: "13px",
  textDecoration: "underline",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "block",
  textAlign: "left",
};

const STATUS_TABS: { value: NgoStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_BADGE: Record<NgoStatus, { text: string; fg: string; bg: string }> = {
  PENDING: { text: "PENDING REVIEW", fg: "#eab308", bg: "rgba(234, 179, 8, 0.15)" },
  APPROVED: { text: "APPROVED", fg: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
  REJECTED: { text: "REJECTED", fg: "#f87171", bg: "rgba(239, 68, 68, 0.15)" },
};

const EMPTY_TEXT: Record<NgoStatus, string> = {
  PENDING: "No pending verification requests.",
  APPROVED: "No approved organizations.",
  REJECTED: "No rejected verification requests.",
};

export const NgosTab: React.FC<NgosTabProps> = ({
  ngos,
  token,
  status,
  onStatusChange,
  loadState,
  health,
  onRetry,
  onApproveNGO,
  onRejectNGO,
  onRevokeNGO,
  onSessionExpired,
}) => {
  const [docError, setDocError] = useState("");

  /**
   * Documents are fetched with the admin token only when the URL is on the
   * API's own origin under /files/private/ (WEB-14); see utils/documents.ts.
   */
  const handleOpenDocument = async (url: string) => {
    if (!token) return;
    setDocError("");
    const result = await openDocument(token, url, API_BASE_URL);
    if (result.ok) return;
    if (result.reason === "http" && result.status === 401) {
      onSessionExpired();
      return;
    }
    setDocError(result.message);
  };

  const hasMore = Boolean(health.nextCursor);

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
          marginBottom: "16px",
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
          NGO Organization Verifications
        </h3>
        <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
          Review both documents before approving — approval grants publishing
          rights
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Verification status"
        style={{ display: "flex", gap: "8px", marginBottom: "20px" }}
      >
        {STATUS_TABS.map(tab => {
          const selected = tab.value === status;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onStatusChange(tab.value)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                border: `1px solid ${selected ? "#6366f1" : "#334155"}`,
                backgroundColor: selected ? "rgba(99, 102, 241, 0.2)" : "#0b0f19",
                color: selected ? "white" : "#94a3b8",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {docError && (
        <div
          role="alert"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            border: "1px solid #ef4444",
            color: "#fca5a5",
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <span>{docError}</span>
          <button
            type="button"
            onClick={() => setDocError("")}
            aria-label="Dismiss"
            style={{
              background: "none",
              border: "none",
              color: "#fca5a5",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {loadState === "loading" ? (
        <p style={{ color: "#94a3b8", fontSize: "14px", textAlign: "center", padding: "40px 0", margin: 0 }}>
          Loading {status.toLowerCase()} verifications…
        </p>
      ) : loadState === "error" ? (
        <FeedError
          label={`${status.toLowerCase()} verifications`}
          health={health}
          onRetry={onRetry}
        />
      ) : ngos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            {EMPTY_TEXT[status]}
          </p>
        </div>
      ) : (
        <>
          {hasMore && (
            <p style={{ fontSize: "12px", color: "#fbbf24", margin: "0 0 12px 0" }}>
              Showing the first {ngos.length} {status.toLowerCase()} requests — more exist.
            </p>
          )}
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
                {[
                  "NGO & Applicant",
                  "Contact Details",
                  "Documents",
                  "Submitted/updated",
                  "Verification Action",
                ].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      padding: "12px 8px",
                      color: "#94a3b8",
                      fontSize: "13px",
                      textAlign: i === 4 ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ngos.map(ngo => {
                const badge = STATUS_BADGE[ngo.status] ?? STATUS_BADGE.PENDING;
                return (
                  <tr
                    key={ngo.id}
                    style={{ borderBottom: "1px solid #1e293b" }}
                  >
                    <td style={{ padding: "16px 8px" }}>
                      <div style={{ fontWeight: "bold" }}>{ngo.name}</div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#94a3b8",
                          marginTop: "4px",
                        }}
                      >
                        {ngo.contactName} · {ngo.email} · {ngo.phone}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "16px 8px",
                        fontSize: "13px",
                        color: "#cbd5e1",
                        maxWidth: "220px",
                        wordBreak: "break-word",
                      }}
                    >
                      {ngo.contactDetails || "—"}
                    </td>
                    <td style={{ padding: "16px 8px" }}>
                      {ngo.registrationDocs ? (
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(ngo.registrationDocs)}
                          style={docButton}
                        >
                          📄 Registration certificate
                        </button>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94a3b8", display: "block" }}>
                          No registration document
                        </span>
                      )}
                      {ngo.identityProof ? (
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(ngo.identityProof)}
                          style={{ ...docButton, marginTop: "6px" }}
                        >
                          🪪 Identity proof
                        </button>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginTop: "6px" }}>
                          No identity proof
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "16px 8px", fontSize: "12px", color: "#94a3b8" }}>
                      {ngo.updatedAt || ngo.submittedAt || "—"}
                      {ngo.submittedAt && ngo.updatedAt && ngo.submittedAt !== ngo.updatedAt && (
                        <div style={{ fontSize: "11px" }}>first submitted {ngo.submittedAt}</div>
                      )}
                      {ngo.status === "APPROVED" && ngo.verifiedAt && (
                        <div style={{ fontSize: "11px" }}>verified {ngo.verifiedAt}</div>
                      )}
                      <div>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "3px 6px",
                            borderRadius: "4px",
                            fontWeight: "bold",
                            backgroundColor: badge.bg,
                            color: badge.fg,
                            display: "inline-block",
                            marginTop: "6px",
                          }}
                        >
                          {badge.text}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "16px 8px", textAlign: "right" }}>
                      {ngo.status === "PENDING" ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => onApproveNGO(ngo.id)}
                            style={{
                              backgroundColor: "#10b981",
                              border: "none",
                              color: "white",
                              padding: "8px 14px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "bold",
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectNGO(ngo.id)}
                            style={{
                              backgroundColor: "transparent",
                              border: "1px solid #ec4899",
                              color: "#ec4899",
                              padding: "8px 14px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "bold",
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : ngo.status === "APPROVED" ? (
                        <button
                          type="button"
                          onClick={() => onRevokeNGO(ngo.id)}
                          style={{
                            backgroundColor: "rgba(239, 68, 68, 0.15)",
                            border: "1px solid #ef4444",
                            color: "#fca5a5",
                            padding: "8px 14px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        >
                          Revoke verification
                        </button>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                          Applicant may resubmit
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};
