"use client";

import DailyChart, { type DayPoint } from "./DailyChart";
import { money } from "@/lib/payments/pricing";
import type { AuditRow, PaymentRow, RegistrationRow } from "@/lib/payments/types";
import { needsAttention } from "./PaymentTable";

export type DashboardJump =
  | { tab: "pending" }
  | { tab: "all"; status?: string }
  | { tab: "zelle" }
  | { tab: "settings" };

const ACTION_LABEL: Record<string, string> = {
  REGISTRATION_CREATED: "registered",
  AUTO_CONFIRMED: "confirmed automatically",
  MARK_PAID: "marked paid",
  AUTO_EXPIRED: "expired unpaid",
  LINK_PAYMENT: "Zelle linked",
  MISMATCH_ACCEPTED: "short amount accepted",
  MISMATCH_NOTED: "short amount noted",
  ADMIN_CREATED: "entered by admin",
  ADJUST_AMOUNT: "amount adjusted",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  RESEND_RECEIPT: "ticket re-sent",
  MERGE: "merged",
  PAYMENT_IGNORED: "Zelle set aside",
};

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Denver" });
}

/** The last 14 days, oldest first, with registrations bucketed by their created day. */
export function buildDays(rows: RegistrationRow[]): DayPoint[] {
  const out: DayPoint[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toLocaleDateString("en-CA", { timeZone: "America/Denver" });
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/Denver",
    });
    out.push({ date: key, label, paid: 0, waiting: 0 });
  }
  const index = new Map(out.map((p, i) => [p.date, i]));
  for (const r of rows) {
    if (r.status === "CANCELLED" || r.status === "REFUNDED") continue;
    const i = index.get(dayKey(r.created_at));
    if (i === undefined) continue;
    if (r.status === "PAID") out[i].paid += 1;
    else out[i].waiting += 1;
  }
  return out;
}

function Tile({
  value,
  label,
  sub,
  onClick,
  tone = "forest",
}: {
  value: string;
  label: string;
  sub?: string;
  onClick?: () => void;
  tone?: "forest" | "amber" | "red";
}) {
  const color =
    tone === "amber" ? "text-amber-700" : tone === "red" ? "text-bengal-red" : "text-forest";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-3xl border border-sand bg-white p-5 text-left shadow-sm ${
        onClick ? "transition-shadow hover:shadow-lg" : ""
      }`}
    >
      <div className={`text-3xl font-black ${color}`}>{value}</div>
      <div className="mt-1 text-sm font-semibold text-forest-ink/80">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-forest-ink/50">{sub}</div>}
    </Tag>
  );
}

export default function Dashboard({
  rows,
  payments,
  audit,
  outbox,
  onJump,
}: {
  rows: RegistrationRow[];
  payments: PaymentRow[];
  audit: AuditRow[];
  outbox: { waiting: number; failed: number } | null;
  onJump: (to: DashboardJump) => void;
}) {
  const live = rows.filter((r) => r.status !== "CANCELLED" && r.status !== "REFUNDED");
  const paid = rows.filter((r) => r.status === "PAID");
  const pending = rows.filter((r) => r.status === "PENDING");
  const expired = rows.filter((r) => r.status === "EXPIRED");
  const collected = paid.reduce((s, r) => s + (r.amount_received ?? 0), 0);
  const expectedPending = pending.reduce((s, r) => s + r.amount_due, 0);
  const adults = paid.reduce((s, r) => s + r.adults, 0);
  const children = paid.reduce((s, r) => s + r.children, 0);
  const coupons = paid.reduce((s, r) => s + r.coupons_qty, 0);
  const donations = paid.reduce((s, r) => s + r.donation, 0);
  const codeEmailed = live.filter((r) => r.pending_email_sent_at).length;
  const receipts = paid.filter((r) => r.receipt_sent_at).length;
  const stale = pending.filter(
    (r) => Date.now() - new Date(r.created_at).getTime() > 48 * 3600000
  ).length;
  const zelleAttention = payments.filter(needsAttention).length;
  const autoConfirmed = paid.filter((r) => r.created_by === "web" && r.payment_method === "zelle").length;

  const funnel = [
    { label: "Registered", n: live.length },
    { label: "Code emailed", n: codeEmailed },
    { label: "Paid", n: paid.length },
    { label: "Ticket sent", n: receipts },
  ];
  const base = Math.max(1, live.length);

  const attention: { text: string; to: DashboardJump; tone: "amber" | "red" }[] = [];
  if (zelleAttention > 0) {
    attention.push({
      text: `${zelleAttention} Zelle transaction${zelleAttention === 1 ? "" : "s"} need a look (no code or short amount)`,
      to: { tab: "zelle" },
      tone: "amber",
    });
  }
  if (stale > 0) {
    attention.push({
      text: `${stale} registration${stale === 1 ? "" : "s"} waiting more than 48 hours for payment`,
      to: { tab: "pending" },
      tone: "amber",
    });
  }
  if (outbox && outbox.failed > 0) {
    attention.push({
      text: `${outbox.failed} email${outbox.failed === 1 ? "" : "s"} could not be sent`,
      to: { tab: "all" },
      tone: "red",
    });
  }
  if (outbox && outbox.waiting > 0) {
    attention.push({
      text: `${outbox.waiting} email${outbox.waiting === 1 ? "" : "s"} waiting for the Gmail relay`,
      to: { tab: "all" },
      tone: "amber",
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          value={String(paid.length)}
          label="Paid registrations"
          sub={`${money(collected)} collected`}
          onClick={() => onJump({ tab: "all", status: "PAID" })}
        />
        <Tile
          value={String(pending.length)}
          label="Waiting for payment"
          sub={`${money(expectedPending)} expected`}
          tone={pending.length ? "amber" : "forest"}
          onClick={() => onJump({ tab: "pending" })}
        />
        <Tile
          value={String(adults + children)}
          label="People attending"
          sub={`${adults} adults, ${children} children, paid only`}
        />
        <Tile
          value={String(coupons)}
          label="Food coupons sold"
          sub={donations > 0 ? `${money(donations)} in donations` : "paid only"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-sand bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
              Progress, all registrations
            </h3>
            <ol className="mt-4 space-y-3">
              {funnel.map((f, i) => (
                <li key={f.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-forest-ink">
                      <span className="mr-2 inline-block w-4 text-center text-xs text-forest-ink/40">
                        {i + 1}
                      </span>
                      {f.label}
                    </span>
                    <span className="text-forest-ink/70">
                      {f.n}
                      <span className="ml-1 text-xs text-forest-ink/40">
                        {Math.round((f.n / base) * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-cream-dim">
                    <div
                      className="h-full rounded-full bg-forest transition-[width]"
                      style={{ width: `${Math.min(100, (f.n / base) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-forest-ink/50">
              {autoConfirmed} of {paid.length} paid registrations were confirmed by the Zelle relay
              without a click. {expired.length} expired unpaid.
            </p>
          </div>

          <DailyChart days={buildDays(rows)} />
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-sand bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
              Needs your attention
            </h3>
            {attention.length === 0 ? (
              <p className="mt-3 text-sm text-forest-ink/60">
                Nothing right now. Payments confirm themselves and tickets go out on their own.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {attention.map((a) => (
                  <li key={a.text}>
                    <button
                      type="button"
                      onClick={() => onJump(a.to)}
                      className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                        a.tone === "red"
                          ? "bg-bengal-red/10 text-bengal-red hover:bg-bengal-red/15"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-200/70"
                      }`}
                    >
                      {a.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-sand bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
              Recent activity
            </h3>
            {audit.length === 0 ? (
              <p className="mt-3 text-sm text-forest-ink/60">No activity yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-sand/70">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-heading font-bold tracking-wider text-forest">
                        {a.entity_code || "system"}
                      </span>{" "}
                      <span className="text-forest-ink/80">
                        {ACTION_LABEL[a.action] || a.action.toLowerCase().replace(/_/g, " ")}
                      </span>
                      {a.actor !== "system" && (
                        <span className="text-forest-ink/50"> by {a.actor}</span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-forest-ink/40">{ago(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
