"use client";

import { useEffect, useState } from "react";
import {
  computeAmount,
  type Pricing,
  type TicketType,
} from "@/lib/payments/pricing";

type Confirmation = {
  code: string;
  amount: string;
  zelle_recipient: string;
  zelle_recipient_name: string;
  breakdown: string[];
  email_sent: boolean;
  contact_email: string;
  reused?: boolean;
};

const inputCls =
  "w-full rounded-xl border border-sand bg-white px-4 py-3 text-forest-ink outline-none transition-colors focus:border-forest";
const labelCls = "mb-1.5 block text-sm font-semibold text-forest-ink";

export default function RegisterForm({ pricing }: { pricing: Pricing }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    adults: 1,
    children: 0,
    ticket_type: "professional" as TicketType,
    coupons_qty: 0,
    donation: 0,
    comment: "",
    announcements: false,
    website: "",
  });
  const [startedAt, setStartedAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Confirmation | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  const estimate = computeAmount(
    {
      adults: form.adults,
      children: form.children,
      ticket_type: form.ticket_type,
      coupons_qty: form.coupons_qty,
      donation: Number(form.donation) || 0,
    },
    pricing
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, started_at: startedAt }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Something went wrong.");
      setDone(data.result as Confirmation);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    }
    setBusy(false);
  };

  const copyCode = async () => {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (done) {
    const mailBody = [
      `Your code: ${done.code}`,
      `Amount: ${done.amount}`,
      `Send via Zelle to: ${done.zelle_recipient} (${done.zelle_recipient_name})`,
      `Put ${done.code} in the Zelle memo/note field.`,
      "",
      ...done.breakdown,
    ].join("\n");
    const mailHref = `mailto:?subject=${encodeURIComponent(
      `BPAU - your code ${done.code} (${done.amount})`
    )}&body=${encodeURIComponent(mailBody)}`;

    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl bg-forest p-8 text-center text-cream shadow-lg">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-cream/70">
            Your code
          </div>
          <div className="font-heading mt-2 text-5xl font-black tracking-[0.15em]">
            {done.code}
          </div>
          <div className="mt-2 text-2xl font-bold">{done.amount}</div>
          <button
            onClick={copyCode}
            className="mt-4 rounded-full bg-cream px-7 py-2.5 font-bold text-forest transition-transform hover:scale-105"
          >
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>
        <div className="mt-6 rounded-3xl border border-sand bg-white p-7 leading-relaxed text-forest-ink">
          {done.reused && (
            <p className="mb-4 rounded-xl bg-cream-dim px-4 py-3 text-sm text-forest-ink/70">
              You already had a pending code for this registration, so here it
              is again.
            </p>
          )}
          <p>
            Send <b>{done.amount}</b> via Zelle to:
          </p>
          <p className="mt-2 text-lg font-bold text-forest">
            {done.zelle_recipient}
          </p>
          <p className="text-sm text-forest-ink/60">
            ({done.zelle_recipient_name})
          </p>
          <p className="mt-4">
            Put <b className="text-bengal-red">{done.code}</b> in the Zelle
            memo/note field.
          </p>
          <ul className="mt-4 space-y-1 border-t border-sand pt-4 text-sm text-forest-ink/70">
            {done.breakdown.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {done.email_sent ? (
            <p className="mt-4 text-sm text-forest-ink/60">
              We emailed these instructions to you. You will receive a receipt
              by email once we confirm the payment.
            </p>
          ) : (
            <div className="mt-4 text-sm text-forest-ink/70">
              <p>
                We could not send the email copy. Copy the code now or write it
                down. You can also{" "}
                <a href={mailHref} className="font-semibold text-forest underline">
                  email these instructions to yourself
                </a>
                .
              </p>
              <p className="mt-2">
                Once we confirm your Zelle, you are in. Bring your name or this
                code to the check-in desk.
              </p>
            </div>
          )}
          {done.contact_email && (
            <p className="mt-3 text-sm text-forest-ink/60">
              Questions? Write to{" "}
              <a href={`mailto:${done.contact_email}`} className="underline">
                {done.contact_email}
              </a>
              .
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="relative mx-auto max-w-xl">
      <p className="mb-6 text-center text-sm text-forest-ink/60">
        Event date: <b>{pricing.event_date}</b> · Registration closes:{" "}
        <b>{pricing.registration_closes}</b>
      </p>

      <div className="space-y-4 rounded-3xl border border-sand bg-white p-7 shadow-sm">
        <div>
          <label className={labelCls}>Full name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className={inputCls}
            placeholder="Your name"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Phone *</label>
            <input
              required
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
              className={inputCls}
              placeholder="801 555 0123"
            />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              className={inputCls}
              placeholder="you@example.com"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Adults</label>
            <input
              type="number"
              min={0}
              max={50}
              value={form.adults}
              onChange={(e) => set({ adults: Number(e.target.value) || 0 })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Children (under 10)</label>
            <input
              type="number"
              min={0}
              max={50}
              value={form.children}
              onChange={(e) => set({ children: Number(e.target.value) || 0 })}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Ticket type</label>
          <select
            value={form.ticket_type}
            onChange={(e) =>
              set({
                ticket_type:
                  e.target.value === "student" ? "student" : "professional",
              })
            }
            className={inputCls}
          >
            <option value="professional">Professional</option>
            <option value="student">Student</option>
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Food coupons</label>
            <input
              type="number"
              min={0}
              max={500}
              value={form.coupons_qty}
              onChange={(e) =>
                set({ coupons_qty: Number(e.target.value) || 0 })
              }
              className={inputCls}
            />
            <p className="mt-1 text-xs text-forest-ink/50">
              ${pricing.coupon_single} each, {pricing.coupon_bundle_qty} for $
              {pricing.coupon_bundle_price}
            </p>
          </div>
          <div>
            <label className={labelCls}>Donation (optional)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={form.donation}
              onChange={(e) => set({ donation: Number(e.target.value) || 0 })}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Comment (optional)</label>
          <textarea
            rows={2}
            value={form.comment}
            onChange={(e) => set({ comment: e.target.value })}
            className={`${inputCls} resize-none`}
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-forest-ink/70">
          <input
            type="checkbox"
            checked={form.announcements}
            onChange={(e) => set({ announcements: e.target.checked })}
            className="mt-1"
          />
          Send me BPAU announcements by email
        </label>

        {/* Honeypot: people never see this field, bots fill it in. */}
        <div
          aria-hidden="true"
          className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden"
        >
          <label>
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => set({ website: e.target.value })}
            />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-cream-dim px-5 py-4 text-lg font-bold">
          <span>Total</span>
          <span className="text-forest">${estimate.toFixed(2)}</span>
        </div>

        {error && (
          <p className="text-sm font-semibold text-bengal-red">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-bengal-red py-4 font-heading font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {busy ? "Saving..." : "Get My Payment Code"}
        </button>
        <p className="text-center text-xs text-forest-ink/50">
          The final amount is confirmed by our system on the next screen.
        </p>
      </div>
    </form>
  );
}
