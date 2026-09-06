"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { money } from "@/lib/payments/pricing";

export type TrackerStatus = {
  code: string;
  name: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "REFUNDED";
  created_at: string;
  amount_due: number;
  amount_received: number | null;
  paid_at: string | null;
  payment_method: string | null;
  code_emailed: boolean;
  receipt_sent: boolean;
  email_queued: boolean;
  adults: number;
  children: number;
  coupons_qty: number;
  breakdown: string[];
  event: { name: string; date: string; time: string; venue: string };
  zelle: { recipient: string; recipient_name: string };
  contact_email: string;
};

type StepState = "done" | "active" | "todo" | "failed";

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Turns a registration into the three steps a member cares about. */
export function stepsFor(s: TrackerStatus | null): {
  title: string;
  detail: string;
  state: StepState;
}[] {
  if (!s) {
    return [
      { title: "Registered", detail: "", state: "done" },
      { title: "Zelle received", detail: "Checking...", state: "active" },
      { title: "Confirmed, ticket sent", detail: "", state: "todo" },
    ];
  }
  const registered = {
    title: "Registered",
    detail: `${when(s.created_at)}${s.code_emailed ? ", code emailed" : s.email_queued ? ", code email on its way" : ""}`,
    state: "done" as StepState,
  };
  if (s.status === "PAID") {
    return [
      registered,
      {
        title: "Zelle received",
        detail: `${money(s.amount_received ?? s.amount_due)} on ${when(s.paid_at)}`,
        state: "done",
      },
      {
        title: "Confirmed, ticket sent",
        detail: s.receipt_sent
          ? "Your ticket is in your inbox."
          : "Your ticket is on its way to your inbox.",
        state: "done",
      },
    ];
  }
  if (s.status === "EXPIRED") {
    return [
      registered,
      {
        title: "Zelle received",
        detail: "No payment arrived in time, so this code expired. Send the Zelle and contact us, or register again.",
        state: "failed",
      },
      { title: "Confirmed, ticket sent", detail: "", state: "todo" },
    ];
  }
  if (s.status === "CANCELLED" || s.status === "REFUNDED") {
    return [
      registered,
      {
        title: s.status === "REFUNDED" ? "Refunded" : "Cancelled",
        detail: "This registration is no longer active. Contact us if that is a surprise.",
        state: "failed",
      },
      { title: "Confirmed, ticket sent", detail: "", state: "todo" },
    ];
  }
  return [
    registered,
    {
      title: "Zelle received",
      detail: `Waiting for ${money(s.amount_due)} with ${s.code} in the memo. This page updates by itself.`,
      state: "active",
    },
    { title: "Confirmed, ticket sent", detail: "Sent by email the moment the payment is matched.", state: "todo" },
  ];
}

/**
 * Live progress for one registration. Polls the status endpoint while the
 * payment is still pending, so the member sees the confirmation happen.
 */
export default function RegistrationTracker({
  code,
  email,
  onStatus,
}: {
  code: string;
  email: string;
  onStatus?: (s: TrackerStatus) => void;
}) {
  const [status, setStatus] = useState<TrackerStatus | null>(null);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const polls = useRef(0);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/status?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Could not check the status.");
      const s = data.result as TrackerStatus;
      setStatus(s);
      setError("");
      setCheckedAt(new Date());
      onStatus?.(s);
      return s;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check the status.");
      return null;
    }
  }, [code, email, onStatus]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      const s = await fetchStatus();
      if (stopped) return;
      polls.current += 1;
      const pending = !s || s.status === "PENDING";
      // Every 15 s for the first 20 minutes, then once a minute for an hour.
      if (pending && polls.current < 140) {
        timer = setTimeout(tick, polls.current < 80 ? 15_000 : 60_000);
      }
    };
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchStatus]);

  const steps = stepsFor(status);
  const paid = status?.status === "PAID";

  return (
    <div className="rounded-3xl border border-sand bg-white p-6 shadow-sm md:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-forest-ink">
          {paid ? "You are in" : "Where things stand"}
        </h2>
        {checkedAt && !paid && (
          <span className="text-xs text-muted-ink">
            Checked {checkedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>

      <ol className="mt-5 space-y-0">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          const dot =
            step.state === "done"
              ? "bg-forest text-ivory"
              : step.state === "active"
                ? "bg-bengal-red text-white animate-pulse"
                : step.state === "failed"
                  ? "bg-bengal-red/15 text-bengal-red"
                  : "bg-cream-dim text-muted-ink";
          return (
            <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
              {!last && (
                <span
                  className={`absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-0.5 ${
                    step.state === "done" ? "bg-forest" : "bg-sand"
                  }`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-heading text-sm font-black ${dot}`}
              >
                {step.state === "done" ? <Icon name="check" className="h-4 w-4" /> : i + 1}
              </span>
              <div className="min-w-0 pt-1">
                <div
                  className={`font-semibold ${
                    step.state === "todo" ? "text-muted-ink" : "text-forest-ink"
                  }`}
                >
                  {step.title}
                </div>
                {step.detail && (
                  <div className="mt-0.5 text-sm text-muted-ink">{step.detail}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="mt-4 rounded-xl bg-bengal-red/10 px-4 py-3 text-sm font-medium text-bengal-red">
          {error}
        </p>
      )}

      {paid && status && (
        <div className="mt-6 rounded-2xl border border-sand bg-cream-dim p-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
            Your ticket
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-ink">Event</dt>
              <dd className="font-semibold text-forest-ink">{status.event.name}</dd>
            </div>
            <div>
              <dt className="text-muted-ink">When</dt>
              <dd className="font-semibold text-forest-ink">
                {status.event.date}
                {status.event.time ? `, ${status.event.time}` : ""}
              </dd>
            </div>
            {status.event.venue && (
              <div className="sm:col-span-2">
                <dt className="text-muted-ink">Where</dt>
                <dd className="font-semibold text-forest-ink">{status.event.venue}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-ink">Ticket holder</dt>
              <dd className="font-semibold text-forest-ink">{status.name}</dd>
            </div>
            <div>
              <dt className="text-muted-ink">Admits</dt>
              <dd className="font-semibold text-forest-ink">
                {status.adults} adult{status.adults === 1 ? "" : "s"}
                {status.children
                  ? `, ${status.children} child${status.children === 1 ? "" : "ren"}`
                  : ""}
                {status.coupons_qty ? `, ${status.coupons_qty} food coupons` : ""}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted-ink">
            Show the ticket email at the check-in desk, or just give your name. Your code{" "}
            <b className="text-forest-ink">{status.code}</b> is on our list.
          </p>
        </div>
      )}
    </div>
  );
}
