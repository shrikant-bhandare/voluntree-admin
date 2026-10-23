"use client";

import { useState } from "react";
import { Check, Download, Wallet, X } from "lucide-react";
import { ApiError } from "../lib/api";
import { useMutation, usePagedList } from "../lib/hooks";
import { useApi } from "../lib/session";
import { useFeedback } from "../lib/feedback";
import { formatDateTime, formatMoney } from "../lib/format";
import { exportToCsv } from "../utils/csvExporter";
import type { PaymentRow, PaymentStatus, PaymentType } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Button, PageHeader, Panel, Segmented, Select, Toolbar } from "../components/ui/primitives";
import { PaymentStatusBadge, PersonLink, paymentTypeLabel } from "../components/common/bits";

type StatusFilter = PaymentStatus | "ALL";

export default function PaymentsView() {
  const api = useApi();
  const { toast, confirm } = useFeedback();
  const { stats, refreshStats, openEvent } = useConsole();
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [type, setType] = useState<PaymentType | "">("");
  const [run, busy] = useMutation();

  const list = usePagedList<PaymentRow>("/payments", {
    status: status === "ALL" ? undefined : status,
    type: type || undefined,
  });

  const settle = async (row: PaymentRow, outcome: "SUCCESS" | "FAILED") => {
    const paid = outcome === "SUCCESS";
    const r = await confirm({
      title: paid ? "Mark this payment as paid?" : "Mark this payment as failed?",
      tone: paid ? "positive" : "danger",
      confirmLabel: paid ? "Mark as paid" : "Mark as failed",
      body: (
        <>
          <p>
            {formatMoney(row.amount, row.currency)} · {paymentTypeLabel(row.type)}
            {row.user ? ` from ${row.user.fullName}` : ""}.
          </p>
          <p>
            {paid
              ? "Use this only when the money has arrived but the gateway confirmation never reached Voluntree. A featured-drive fee features the drive straight away, and the payer gets a receipt."
              : "The payment stays on record as failed. Nothing is charged or refunded by this action."}
          </p>
        </>
      ),
      note: {
        label: "Gateway or bank reference",
        placeholder: "e.g. bank statement line, gateway payment ID",
        minLength: 3,
        hint: "Stored with the payment and in the audit log.",
      },
    });
    if (!r.confirmed) return;

    await run(row.id, async () => {
      try {
        await api("/payments/admin/settle", {
          method: "POST",
          body: { txRef: row.txRef, status: outcome, gatewayReference: r.note },
        });
        list.updateItem(row.id, { status: outcome, gatewayReference: r.note });
        refreshStats();
        toast({ title: paid ? "Payment marked as paid" : "Payment marked as failed", description: row.txRef });
      } catch (err) {
        toast({ tone: "error", title: "Could not update the payment", description: err instanceof ApiError ? err.message : undefined });
      }
    });
  };

  const columns: Column<PaymentRow>[] = [
    {
      key: "payer",
      header: "Payer",
      primary: true,
      cell: p =>
        p.user ? (
          <PersonLink id={p.userId} name={p.user.fullName} secondary={p.user.email} />
        ) : (
          <span className="text-ink-3">Account deleted</span>
        ),
    },
    { key: "type", header: "Type", cell: p => paymentTypeLabel(p.type) },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: p => <span className="tabular font-semibold">{formatMoney(p.amount, p.currency)}</span>,
    },
    {
      key: "drive",
      header: "Drive",
      hideOnMobile: true,
      cell: p =>
        p.event && p.eventId ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              openEvent(p.eventId as string);
            }}
            className="rounded-sm text-left text-forest underline decoration-forest/30 underline-offset-[3px] hover:decoration-forest"
          >
            {p.event.title}
          </button>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: "ref",
      header: "Reference",
      hideOnMobile: true,
      cell: p => (
        <span className="block max-w-[14rem] truncate text-meta text-ink-2" title={p.gatewayReference ?? p.txRef}>
          {p.txRef}
        </span>
      ),
    },
    { key: "date", header: "Date", cell: p => <span className="text-meta text-ink-2">{formatDateTime(p.createdAt)}</span> },
    { key: "status", header: "Status", cell: p => <PaymentStatusBadge status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every donation, subscription and featured-drive fee. Settle a payment by hand only when the gateway confirmation went missing."
        actions={
          <Button
            icon={Download}
            disabled={list.items.length === 0}
            onClick={() =>
              exportToCsv(
                "voluntree_payments",
                ["Date", "Payer", "Email", "Type", "Amount", "Currency", "Status", "Reference", "Gateway reference", "Drive"],
                list.items.map(p => [
                  formatDateTime(p.createdAt),
                  p.user?.fullName ?? "",
                  p.user?.email ?? "",
                  paymentTypeLabel(p.type),
                  p.amount,
                  p.currency,
                  p.status,
                  p.txRef,
                  p.gatewayReference ?? "",
                  p.event?.title ?? "",
                ])
              )
            }
          >
            Export loaded rows
          </Button>
        }
      />

      <Toolbar>
        <Segmented<StatusFilter>
          label="Payment status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "PENDING", label: "Pending", count: stats?.payments.pending },
            { value: "SUCCESS", label: "Paid", count: stats?.payments.successful },
            { value: "FAILED", label: "Failed" },
            { value: "ALL", label: "All" },
          ]}
        />
        <Select
          aria-label="Payment type"
          value={type}
          onChange={e => setType(e.target.value as PaymentType | "")}
          className="w-full sm:w-56"
        >
          <option value="">All types</option>
          <option value="DONATION">Donations</option>
          <option value="PREMIUM_SUBSCRIBER">Premium subscriptions</option>
          <option value="FEATURED_EVENT_FEE">Featured drive fees</option>
        </Select>
      </Toolbar>

      <Panel bodyClassName="p-0">
        <DataTable
          caption="Payments"
          columns={columns}
          rows={list.items}
          rowKey={p => p.id}
          state={list.state}
          error={list.error}
          onRetry={list.reload}
          hasMore={list.hasMore}
          loadingMore={list.loadingMore}
          onLoadMore={list.loadMore}
          empty={{
            icon: Wallet,
            title: status === "PENDING" ? "No payments waiting" : "No payments here",
            body:
              status === "PENDING"
                ? "Payments settle automatically when the gateway confirms them. Anything stuck shows up here."
                : "Try another status or type.",
          }}
          actions={p =>
            p.status === "PENDING" ? (
              <>
                <Button size="sm" variant="positive" icon={Check} loading={busy === p.id} onClick={() => settle(p, "SUCCESS")}>
                  Mark paid
                </Button>
                <Button size="sm" variant="danger-quiet" icon={X} disabled={busy === p.id} onClick={() => settle(p, "FAILED")}>
                  Mark failed
                </Button>
              </>
            ) : null
          }
        />
      </Panel>
    </>
  );
}
