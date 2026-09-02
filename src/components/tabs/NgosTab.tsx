"use client";

import React from "react";
import { NGO } from "../../types";

interface NgosTabProps {
  ngos: NGO[];
  token: string | null;
  onApproveNGO: (id: string) => void;
  onRejectNGO: (id: string) => void;
}

/**
 * Verification documents live in the private bucket behind a Bearer-guarded
 * route; a plain anchor cannot send the header, so every click used to 401 —
 * admins were approving NGOs whose documents they could not open. Fetch with
 * the token and open the blob in a new tab.
 *
 * The tab is opened synchronously inside the click so pop-up blockers allow
 * it; the blob URL is assigned once the download completes.
 */
async function openDocument(token: string, url: string) {
  const tab = window.open("", "_blank");
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      tab?.close();
      alert(`Could not open the document (HTTP ${res.status}).`);
      return;
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = objectUrl;
    } else {
      window.open(objectUrl, "_blank", "noopener");
    }
    // Give the new tab time to load the blob before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch {
    tab?.close();
    alert("Could not open the document — network error.");
  }
}

const docButton: React.CSSProperties = {
  color: "#6366f1",
  fontSize: "13px",
  textDecoration: "underline",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "block",
  textAlign: "left",
};

export const NgosTab: React.FC<NgosTabProps> = ({
  ngos,
  token,
  onApproveNGO,
  onRejectNGO,
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
          Pending NGO Organization Submissions
        </h3>
        <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
          Review both documents before approving — approval grants publishing
          rights
        </span>
      </div>

      {ngos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            No pending verification requests.
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
              {[
                "NGO & Applicant",
                "Contact Details",
                "Documents",
                "Submitted",
                "",
              ].map((h, i) => (
                <th
                  key={h || i}
                  style={{
                    padding: "12px 8px",
                    color: "#94a3b8",
                    fontSize: "13px",
                    textAlign: i === 4 ? "right" : "left",
                  }}
                >
                  {h || "Verification Action"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ngos.map(ngo => (
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
                      onClick={() => token && openDocument(token, ngo.registrationDocs)}
                      style={docButton}
                    >
                      📄 Registration certificate
                    </button>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>
                      No registration document
                    </span>
                  )}
                  {ngo.identityProof ? (
                    <button
                      onClick={() => token && openDocument(token, ngo.identityProof)}
                      style={{ ...docButton, marginTop: "6px" }}
                    >
                      🪪 Identity proof
                    </button>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#64748b", display: "block", marginTop: "6px" }}>
                      No identity proof
                    </span>
                  )}
                </td>
                <td style={{ padding: "16px 8px", fontSize: "12px", color: "#94a3b8" }}>
                  {ngo.submittedAt || "—"}
                  <div>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "3px 6px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        backgroundColor: "rgba(234, 179, 8, 0.15)",
                        color: "#eab308",
                        display: "inline-block",
                        marginTop: "6px",
                      }}
                    >
                      PENDING REVIEW
                    </span>
                  </div>
                </td>
                <td style={{ padding: "16px 8px", textAlign: "right" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
