"use client";

import StatusBadge from "./StatusBadge";
import { money } from "@/lib/payments/pricing";
import type { RegistrationRow } from "@/lib/payments/types";

export type RowAction =
  | "mark_paid"
  | "void"
  | "adjust"
  | "resend"
  | "merge"
  | "history";

function ageHours(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600000));
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function emailState(r: RegistrationRow): { label: string; tone: string } {
  if (!r.email) return { label: "no email", tone: "text-stone-500" };
  if (r.status === "PAID") {
    return r.receipt_sent_at
      ? { label: "receipt sent", tone: "text-forest" }
      : { label: "receipt not sent", tone: "text-bengal-red" };
  }
  if (r.pending_email_sent_at) return { label: "code emailed", tone: "text-forest" };
  if (r.email_error === "no_provider") {
    return { label: "code not emailed (email off)", tone: "text-amber-700" };
  }
  return { label: "code email failed", tone: "text-bengal-red" };
}

function Btn({
  children,
  onClick,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const tone = primary
    ? "bg-forest text-cream"
    : danger
      ? "border border-bengal-red text-bengal-red hover:bg-bengal-red hover:text-white"
      : "border border-sand text-forest-ink/80 hover:border-forest";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${tone}`}
    >
      {children}
    </button>
  );
}

export default function RegistrationTable({
  rows,
  mode,
  onAction,
  emptyText,
}: {
  rows: RegistrationRow[];
  mode: "pending" | "all";
  onAction: (action: RowAction, row: RegistrationRow) => void;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-forest-ink/50">{emptyText}</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const hours = ageHours(r.created_at);
        const stale = r.status === "PENDING" && hours > 48;
        const es = emailState(r);
        const canPay = r.status === "PENDING" || r.status === "EXPIRED";
        return (
          <div
            key={r.code}
            className={`rounded-2xl border bg-white px-5 py-4 ${
              stale ? "border-amber-300" : "border-sand"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => onAction("history", r)}
                className="font-heading text-lg font-black tracking-wider text-forest hover:underline"
              >
                {r.code}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-forest-ink">{r.name}</div>
                <div className="truncate text-xs text-forest-ink/50">
                  {r.phone || "no phone"} · {r.email || "no email"}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-forest-ink">{money(r.amount_due)}</div>
                {r.status === "PAID" &&
                  r.amount_received !== null &&
                  r.amount_received !== r.amount_due && (
                    <div className="text-xs text-forest-ink/60">
                      received {money(r.amount_received)}
                    </div>
                  )}
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-forest-ink/60">
              <span>
                {when(r.created_at)}
                {r.status === "PENDING" ? ` (${hours}h ago)` : ""}
              </span>
              {r.status === "PAID" && (
                <span>
                  paid {r.paid_at ? when(r.paid_at) : ""} via {r.payment_method}
                </span>
              )}
              <span className={es.tone}>{es.label}</span>
              {r.created_by !== "web" && <span>entered by {r.created_by}</span>}
              {stale && (
                <span className="font-semibold text-amber-700">
                  waiting more than 48 hours
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {canPay && (
                <Btn primary onClick={() => onAction("mark_paid", r)}>
                  Mark paid
                </Btn>
              )}
              {canPay && mode === "all" && (
                <Btn onClick={() => onAction("adjust", r)}>Adjust amount</Btn>
              )}
              {canPay && mode === "all" && (
                <Btn onClick={() => onAction("merge", r)}>Merge into...</Btn>
              )}
              {r.status === "PAID" && (
                <Btn onClick={() => onAction("resend", r)}>Resend receipt</Btn>
              )}
              {(canPay || r.status === "PAID") && (
                <Btn danger onClick={() => onAction("void", r)}>
                  {r.status === "PAID" ? "Refund / void" : "Void"}
                </Btn>
              )}
              <Btn onClick={() => onAction("history", r)}>History</Btn>
            </div>
          </div>
        );
      })}
    </div>
  );
}
