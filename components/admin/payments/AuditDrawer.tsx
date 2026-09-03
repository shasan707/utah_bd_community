"use client";

import { useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import { getSupabase } from "@/lib/supabase";
import { money } from "@/lib/payments/pricing";
import type { AuditRow, RegistrationRow } from "@/lib/payments/types";

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-forest-ink/50">{label}</div>
      <div className="text-sm text-forest-ink">{value || "-"}</div>
    </div>
  );
}

/** Full details of one registration plus every audit row written for it. */
export default function AuditDrawer({
  row,
  onClose,
}: {
  row: RegistrationRow;
  onClose: () => void;
}) {
  const [log, setLog] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    getSupabase()
      .from("audit_log")
      .select("*")
      .eq("entity_code", row.code)
      .order("at", { ascending: false })
      .then(({ data }) => setLog((data as AuditRow[]) ?? []));
  }, [row.code]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-forest-ink/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-lg overflow-y-auto bg-cream p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="font-heading text-2xl font-black tracking-wider text-forest">
            {row.code}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-sand px-4 py-1.5 text-sm font-semibold text-forest-ink/70"
          >
            Close
          </button>
        </div>
        <div className="mt-2">
          <StatusBadge status={row.status} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border border-sand bg-white p-5">
          <Detail label="Name" value={row.name} />
          <Detail label="Created" value={when(row.created_at)} />
          <Detail label="Phone" value={row.phone} />
          <Detail label="Email" value={row.email} />
          <Detail
            label="Party"
            value={`${row.adults} adult${row.adults === 1 ? "" : "s"} (${row.ticket_type}), ${row.children} child${row.children === 1 ? "" : "ren"}`}
          />
          <Detail
            label="Extras"
            value={`${row.coupons_qty} coupons, ${money(row.donation)} donation`}
          />
          <Detail label="Amount due" value={money(row.amount_due)} />
          <Detail
            label="Received"
            value={
              row.amount_received !== null
                ? `${money(row.amount_received)} via ${row.payment_method ?? ""} on ${when(row.paid_at)}`
                : ""
            }
          />
          <Detail label="Entered by" value={row.created_by} />
          <Detail
            label="Emails"
            value={
              row.pending_email_sent_at || row.receipt_sent_at
                ? [
                    row.pending_email_sent_at && `code ${when(row.pending_email_sent_at)}`,
                    row.receipt_sent_at && `receipt ${when(row.receipt_sent_at)}`,
                  ]
                    .filter(Boolean)
                    .join(", ")
                : row.email_error || "none sent"
            }
          />
          <div className="col-span-2">
            <Detail label="Comment" value={row.comment} />
          </div>
          <div className="col-span-2">
            <Detail label="Notes" value={row.notes} />
          </div>
        </div>

        <h3 className="mt-6 font-bold text-forest-ink">History</h3>
        <div className="mt-2 space-y-2">
          {log === null && <p className="text-sm text-forest-ink/50">Loading...</p>}
          {log?.length === 0 && (
            <p className="text-sm text-forest-ink/50">No audit rows yet.</p>
          )}
          {log?.map((a) => (
            <div key={a.id} className="rounded-2xl border border-sand bg-white px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold text-forest-ink">{a.action}</span>
                <span className="text-xs text-forest-ink/50">{when(a.at)}</span>
              </div>
              <div className="text-xs text-forest-ink/60">by {a.actor}</div>
              {a.note && <div className="mt-1 text-forest-ink/80">{a.note}</div>}
              {(a.before != null || a.after != null) && (
                <div className="mt-1 break-all font-mono text-[11px] text-forest-ink/50">
                  {a.before ? JSON.stringify(a.before) : "{}"} {"->"}{" "}
                  {a.after ? JSON.stringify(a.after) : "{}"}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
