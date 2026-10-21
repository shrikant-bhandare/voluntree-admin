"use client";

import React from "react";
import { FeedHealth } from "../../types";

export function describeFeedError(status: number | null): string {
  if (status === -1) return "timed out";
  if (status === 0 || status === null) return "network error";
  return `HTTP ${status}`;
}

/**
 * Shown instead of a tab's empty state when its feed has never loaded, so an
 * outage does not read as "no reports" / "no users".
 */
export const FeedError: React.FC<{
  label: string;
  health: FeedHealth | undefined;
  onRetry: () => void;
}> = ({ label, health, onRetry }) => (
  <div
    role="alert"
    style={{
      backgroundColor: "rgba(239, 68, 68, 0.08)",
      border: "1px solid rgba(239, 68, 68, 0.4)",
      borderRadius: "14px",
      padding: "28px",
      textAlign: "center",
      color: "#fca5a5",
      fontSize: "14px",
    }}
  >
    Could not load {label} ({describeFeedError(health?.lastErrorStatus ?? null)}).{" "}
    <button
      type="button"
      onClick={onRetry}
      style={{
        marginLeft: "8px",
        backgroundColor: "#1e293b",
        border: "1px solid #334155",
        color: "white",
        padding: "6px 14px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Retry
    </button>
  </div>
);

/** "Showing newest N" when the API says more rows exist than are loaded. */
export const TruncationNote: React.FC<{
  shown: number;
  hasMore: boolean;
  total?: number;
  noun: string;
  order?: "newest" | "oldest" | "first";
}> = ({ shown, hasMore, total, noun, order = "newest" }) => {
  const knownMore = typeof total === "number" && total > shown;
  if (!hasMore && !knownMore) {
    return (
      <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
        {typeof total === "number" ? total : shown} {noun}
      </span>
    );
  }
  return (
    <span style={{ fontSize: "12px", color: "#fbbf24" }}>
      Showing {order} <strong>{shown}</strong>
      {knownMore ? (
        <>
          {" "}
          of <strong>{total}</strong>
        </>
      ) : null}{" "}
      {noun}
      {!knownMore && hasMore ? " — more available" : ""}
    </span>
  );
};

export const LoadMoreButton: React.FC<{
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}> = ({ hasMore, loading, onLoadMore }) =>
  hasMore ? (
    <div style={{ textAlign: "center", marginTop: "16px" }}>
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        style={{
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          color: "white",
          padding: "8px 18px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Loading…" : "Load more"}
      </button>
    </div>
  ) : null;
