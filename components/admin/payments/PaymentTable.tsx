"use client";

import { money } from "@/lib/payments/pricing";
import type { MatchStatus, PaymentRow } from "@/lib/payments/types";

export type PaymentAction = "link" | "apply" | "accept" | "note";

const badge: Record<MatchStatus, string> = {
  UNMATCHED: "bg-amber-100 text-amber-800",
  MATCHED: "bg-forest/10 text-forest",
  AMOUNT_MISMATCH: "bg-bengal-red/10 text-bengal-red",
  DUPLICATE: "bg-stone-200 text-stone-700",
};

const label: Record<MatchStatus, string> = {
  UNMATCHED: "no match",
  MATCHED: "matched",
  AMOUNT_MISMATCH: "amount short",
  DUPLICATE: "duplicate",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** True when the treasurer still has to do something with this transaction. */
export function needsAttention(p: PaymentRow): boolean {
  if (p.match_status === "DUPLICATE") return false;
  if (p.match_status === "UNMATCHED") return true;
  return !p.processed_at;
}

function Btn({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        primary
          ? "bg-forest text-cream"
          : "border border-sand text-forest-ink/80 hover:border-forest"
      }`}
    >
      {children}
    </button>
  );
}

export default function PaymentTable({
  rows,
  onAction,
  emptyText,
}: {
  rows: PaymentRow[];
  onAction: (action: PaymentAction, row: PaymentRow) => void;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-forest-ink/50">{emptyText}</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((p) => {
        const open = needsAttention(p);
        return (
          <div
            key={p.id}
            className={`rounded-2xl border bg-white px-5 py-4 ${
              open ? "border-amber-300" : "border-sand"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-forest-ink">
                  {p.sender_name || "unknown sender"}
                </div>
                <div className="truncate text-xs text-forest-ink/50">
                  memo: {p.memo_raw || "(none)"}
                </div>
              </div>
              <div className="font-bold text-forest-ink">{money(p.amount)}</div>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ${badge[p.match_status]}`}
              >
                {label[p.match_status]}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-forest-ink/60">
              <span>{when(p.received_at)}</span>
              <span>conf. {p.confirmation_id}</span>
              <span>{p.source === "email" ? "from bank email" : "typed in"}</span>
              {p.linked_code && (
                <span className="font-semibold text-forest">
                  code {p.linked_code}
                  {p.processed_at ? " (applied)" : " (not applied yet)"}
                </span>
              )}
              {!p.linked_code && p.extracted_code && (
                <span>possible codes: {p.extracted_code}</span>
              )}
              {!p.linked_code && p.suggested_code && (
                <span className="font-semibold text-amber-700">
                  looks like {p.suggested_code}
                </span>
              )}
            </div>
            {open && (
              <div className="mt-3 flex flex-wrap gap-2">
                {p.match_status === "UNMATCHED" && (
                  <Btn primary onClick={() => onAction("link", p)}>
                    Link to a code
                  </Btn>
                )}
                {p.match_status === "MATCHED" && (
                  <Btn primary onClick={() => onAction("apply", p)}>
                    Confirm {p.linked_code}
                  </Btn>
                )}
                {p.match_status === "AMOUNT_MISMATCH" && (
                  <>
                    <Btn primary onClick={() => onAction("accept", p)}>
                      Accept the amount
                    </Btn>
                    <Btn onClick={() => onAction("note", p)}>Note and chase</Btn>
                    <Btn onClick={() => onAction("link", p)}>Link elsewhere</Btn>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
