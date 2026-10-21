"use client";

import React from "react";
import { PaymentTransaction } from "../../types";
import { exportToCsv } from "../../utils/csvExporter";
import { formatMoney } from "../../utils/format";
import { LoadMoreButton, TruncationNote } from "../common/FeedStatus";

interface PaymentsTabProps {
  transactions: PaymentTransaction[];
  totalRevenue: number;
  pendingPaymentsCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({
  transactions,
  totalRevenue,
  pendingPaymentsCount,
  hasMore,
  loadingMore,
  onLoadMore,
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
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "white",
              margin: 0,
            }}
          >
            Payments & Donations
          </h3>
          <button
            onClick={() =>
              exportToCsv(
                "payments_report",
                [
                  "Donor",
                  "Type",
                  "Event",
                  "Amount",
                  "Currency",
                  "Status",
                  "TxRef",
                  "Date",
                ],
                transactions.map(t => [
                  t.donor,
                  t.type,
                  t.eventName || "",
                  t.amount,
                  t.currency,
                  t.status,
                  t.txRef,
                  t.date,
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
              marginTop: "8px",
            }}
          >
            📥 Export Payments CSV
          </button>
          <div style={{ marginTop: "8px" }}>
            <TruncationNote
              shown={transactions.length}
              hasMore={hasMore}
              noun="transactions"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              backgroundColor: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: "10px",
              padding: "8px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              Total Revenue
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: "#10b981",
              }}
            >
              {formatMoney(totalRevenue, "INR")}
            </div>
          </div>
          <div
            style={{
              backgroundColor: "rgba(234,179,8,0.1)",
              border: "1px solid rgba(234,179,8,0.3)",
              borderRadius: "10px",
              padding: "8px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>Pending</div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: "#eab308",
              }}
            >
              {pendingPaymentsCount}
            </div>
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            No payment transactions recorded.
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
                Donor / Org
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Type
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Event
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Amount
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Date
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
                }}
              >
                Tx Ref
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr
                key={tx.id}
                style={{ borderBottom: "1px solid #1e293b" }}
              >
                <td style={{ padding: "14px 8px" }}>
                  <div style={{ fontWeight: "bold" }}>{tx.donor}</div>
                </td>
                <td style={{ padding: "14px 8px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "3px 6px",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      backgroundColor:
                        tx.type === "PREMIUM_SUBSCRIBER"
                          ? "rgba(16,185,129,0.15)"
                          : tx.type === "FEATURED_EVENT_FEE"
                          ? "rgba(234,179,8,0.15)"
                          : "rgba(99,102,241,0.15)",
                      color:
                        tx.type === "PREMIUM_SUBSCRIBER"
                          ? "#10b981"
                          : tx.type === "FEATURED_EVENT_FEE"
                          ? "#eab308"
                          : "#6366f1",
                    }}
                  >
                    {tx.type}
                  </span>
                </td>
                <td
                  style={{
                    padding: "14px 8px",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  {tx.eventName ?? "Platform Fund"}
                </td>
                <td
                  style={{
                    padding: "14px 8px",
                    fontWeight: "bold",
                    color: "#10b981",
                  }}
                >
                  {formatMoney(tx.amount, tx.currency)}
                </td>
                <td
                  style={{
                    padding: "14px 8px",
                    color: "#64748b",
                    fontSize: "12px",
                  }}
                >
                  {tx.date}
                </td>
                <td style={{ padding: "14px 8px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "3px 6px",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      backgroundColor:
                        tx.status === "SUCCESS"
                          ? "rgba(16,185,129,0.15)"
                          : tx.status === "PENDING"
                          ? "rgba(234,179,8,0.15)"
                          : "rgba(239,68,68,0.15)",
                      color:
                        tx.status === "SUCCESS"
                          ? "#10b981"
                          : tx.status === "PENDING"
                          ? "#eab308"
                          : "#ef4444",
                    }}
                  >
                    {tx.status}
                  </span>
                </td>
                <td
                  style={{
                    padding: "14px 8px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >
                  {tx.txRef}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <LoadMoreButton hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  );
};
