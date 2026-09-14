"use client";

import { useEffect, useState } from "react";
import Alpona from "@/components/Alpona";
import Icon from "@/components/Icon";
import RegistrationTracker, { type TrackerStatus } from "@/components/RegistrationTracker";
import ZelleLogo from "@/components/ZelleLogo";
import UsFlag from "@/components/UsFlag";
import {
  breakdownLines,
  bundleSize,
  computeAmount,
  money,
  priceLabel,
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
  email_queued?: boolean;
  contact_email: string;
  reused?: boolean;
};

const inputCls =
  "w-full rounded-xl border border-sand bg-ivory px-4 py-3 text-forest-ink outline-none transition-colors placeholder:text-muted-ink/60 focus:border-forest focus:bg-white";
const labelCls = "mb-1.5 block text-sm font-semibold text-forest-ink";
const helpCls = "mt-1.5 text-xs text-muted-ink";

const emptyForm = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  adults: 1,
  children: 0,
  ticket_type: "professional" as TicketType,
  coupons_qty: 0,
  bundles_qty: 0,
  comment: "",
  announcements: false,
  website: "",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
      {children}
    </h3>
  );
}

function Stepper({
  label,
  hint,
  value,
  min = 0,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const btn =
    "flex h-12 w-12 shrink-0 items-center justify-center text-xl font-bold text-forest transition-colors hover:bg-cream-dim disabled:opacity-30";
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="flex items-center overflow-hidden rounded-xl border border-sand bg-ivory">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - 1))}
          className={btn}
        >
          -
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
          className="w-full bg-transparent text-center text-lg font-bold text-forest-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
          className={btn}
        >
          +
        </button>
      </div>
      {hint && <p className={helpCls}>{hint}</p>}
    </div>
  );
}

export default function RegisterForm({ pricing }: { pricing: Pricing }) {
  const [form, setForm] = useState(emptyForm);
  const [startedAt, setStartedAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Confirmation | null>(null);
  const [doneEmail, setDoneEmail] = useState("");
  const [live, setLive] = useState<TrackerStatus | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  // Bundles are just a faster way to pick coupons: the form adds them up and
  // the server prices the total, charging the bundle rate for every full ten.
  const totalCoupons =
    form.coupons_qty + form.bundles_qty * bundleSize(pricing);
  const items = {
    adults: form.adults,
    children: form.children,
    ticket_type: form.ticket_type,
    coupons_qty: totalCoupons,
    donation: 0,
  };
  const estimate = computeAmount(items, pricing);
  const lines = breakdownLines(items, pricing);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          coupons_qty: totalCoupons,
          name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
          started_at: startedAt,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Something went wrong.");
      setDoneEmail(form.email.trim().toLowerCase());
      setLive(null);
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

  const reset = () => {
    setDone(null);
    setDoneEmail("");
    setLive(null);
    setForm(emptyForm);
    setStartedAt(Date.now());
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

    const payLine = (
      <>
        Send <b className="text-forest-ink">{done.amount}</b> to{" "}
        <b className="text-forest-ink">{done.zelle_recipient}</b>
        {done.zelle_recipient_name && (
          <span className="text-muted-ink"> ({done.zelle_recipient_name})</span>
        )}
        .
      </>
    );

    const paid = live?.status === "PAID";
    const trackHref = `/register/status?code=${encodeURIComponent(done.code)}`;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="emerald-panel relative overflow-hidden rounded-3xl p-8 text-center text-ivory md:p-10">
          <Alpona className="floral-soft absolute -right-16 -top-16 h-56 w-56" />
          <div className="relative">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-mint">
              Your payment code
            </div>
            <div className="font-heading mt-3 text-5xl font-black tracking-[0.15em] md:text-6xl">
              {done.code}
            </div>
            <div className="mt-3 text-2xl font-bold text-ivory-dim">
              {done.amount}
            </div>
            <button
              onClick={copyCode}
              className="mt-5 rounded-full bg-ivory px-7 py-2.5 font-bold text-forest transition-transform hover:scale-105"
            >
              {copied ? "Copied" : "Copy code"}
            </button>
            {done.reused && (
              <p className="mt-4 text-sm text-mint">
                You already had a pending code for this registration, so here it
                is again.
              </p>
            )}
          </div>
        </div>

        <RegistrationTracker code={done.code} email={doneEmail} onStatus={setLive} />

        <div
          className={`rounded-3xl border border-sand bg-white p-7 shadow-sm md:p-8 ${
            paid ? "hidden" : ""
          }`}
        >
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold text-forest-ink">
            Now send with <ZelleLogo size="md" />
          </h2>
          <ol className="mt-5 space-y-4">
            {[
              <>
                Open your bank app and choose <ZelleLogo size="sm" />.
              </>,
              payLine,
              <>
                Type <b className="text-bengal-red">{done.code}</b> in the memo
                or note field. This is how we match the payment to you.
              </>,
            ].map((content, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest font-heading text-sm font-black text-ivory">
                  {i + 1}
                </span>
                <p className="pt-1 leading-relaxed text-forest-ink/80">{content}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-2xl bg-cream-dim px-5 py-4">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
              What you are paying for
            </div>
            <ul className="mt-2 space-y-1 text-sm text-forest-ink/80">
              {done.breakdown.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex items-start gap-3 text-sm text-muted-ink">
            <Icon name="mail" className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
            {done.email_sent ? (
              <p>
                We emailed these instructions to you. Your receipt arrives by
                email once the payment is confirmed.
              </p>
            ) : done.email_queued ? (
              <p>
                These instructions are on their way to your inbox and should
                arrive within a few minutes. Your receipt follows once the
                payment is confirmed. If nothing arrives, you can{" "}
                <a href={mailHref} className="font-semibold text-forest underline">
                  email them to yourself
                </a>
                .
              </p>
            ) : (
              <p>
                We could not send the email copy, so keep this code safe or{" "}
                <a href={mailHref} className="font-semibold text-forest underline">
                  email these instructions to yourself
                </a>
                . Once your Zelle is confirmed you are in; bring your name or
                this code to the check-in desk.
              </p>
            )}
          </div>
          {done.contact_email && (
            <p className="mt-3 pl-7 text-sm text-muted-ink">
              Questions? Write to{" "}
              <a
                href={`mailto:${done.contact_email}`}
                className="font-semibold text-forest underline"
              >
                {done.contact_email}
              </a>
              .
            </p>
          )}
        </div>

        <p className="text-center text-sm text-muted-ink">
          Closing this page is fine. Check later at{" "}
          <a href={trackHref} className="font-semibold text-forest underline">
            track your registration
          </a>{" "}
          with your code and email.
        </p>
        <p className="text-center text-sm text-muted-ink">
          Registering for someone else too?{" "}
          <button
            type="button"
            onClick={reset}
            className="font-semibold text-forest underline"
          >
            Start another registration
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <form
        onSubmit={submit}
        className="relative rounded-3xl border border-sand bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="space-y-8">
          <div className="space-y-4">
            <SectionTitle>Your details</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-first" className={labelCls}>
                  First name
                </label>
                <input
                  id="reg-first"
                  required
                  autoComplete="given-name"
                  value={form.first_name}
                  onChange={(e) => set({ first_name: e.target.value })}
                  className={inputCls}
                  placeholder="Rahim"
                />
              </div>
              <div>
                <label htmlFor="reg-last" className={labelCls}>
                  Last name
                </label>
                <input
                  id="reg-last"
                  required
                  autoComplete="family-name"
                  value={form.last_name}
                  onChange={(e) => set({ last_name: e.target.value })}
                  className={inputCls}
                  placeholder="Uddin"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-phone" className={labelCls}>
                  Phone
                </label>
                <div className="flex items-center rounded-xl border border-sand bg-ivory focus-within:border-forest focus-within:bg-white">
                  <span className="flex items-center gap-1.5 pl-3.5 text-sm font-semibold text-forest-ink/60">
                    <UsFlag />
                    +1
                  </span>
                  <input
                    id="reg-phone"
                    required
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={form.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                    className="w-full bg-transparent px-3 py-3 text-forest-ink outline-none placeholder:text-muted-ink/60"
                    placeholder="(801) 555-0123"
                  />
                </div>
                <p className={helpCls}>
                  US mobile number. We text your payment code and your ticket
                  to it, nothing else. Reply STOP at any time to stop the
                  texts. Standard message rates apply.
                </p>
              </div>
              <div>
                <label htmlFor="reg-email" className={labelCls}>
                  Email
                </label>
                <input
                  id="reg-email"
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  className={inputCls}
                  placeholder="you@example.com"
                />
                <p className={helpCls}>Your code and receipt go here.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-sand pt-8">
            <SectionTitle>Who is coming</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Stepper
                label="Adults"
                value={form.adults}
                max={50}
                onChange={(v) => set({ adults: v })}
              />
              <Stepper
                label="Children"
                hint={
                  pricing.price_child > 0
                    ? `Under 10, ${money(pricing.price_child)} each`
                    : "Under 10, free"
                }
                value={form.children}
                max={50}
                onChange={(v) => set({ children: v })}
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-sand pt-8">
            <SectionTitle>Raffle draw</SectionTitle>
            <div className="space-y-4">
              <Stepper
                label="Raffle draw coupons"
                hint={`${money(pricing.coupon_single)} each`}
                value={form.coupons_qty}
                max={50}
                onChange={(v) => set({ coupons_qty: v })}
              />
              <Stepper
                label={`Bundles of ${pricing.coupon_bundle_qty} coupons`}
                hint={`${money(pricing.coupon_bundle_price)} per bundle, saving ${money(
                  pricing.coupon_bundle_qty * pricing.coupon_single -
                    pricing.coupon_bundle_price
                )}`}
                value={form.bundles_qty}
                max={20}
                onChange={(v) => set({ bundles_qty: v })}
              />
              {totalCoupons > 0 && (
                <p className={helpCls}>
                  {totalCoupons} coupon{totalCoupons > 1 ? "s" : ""} in total.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4 border-t border-sand pt-8">
            <SectionTitle>Anything else</SectionTitle>
            <div>
              <label htmlFor="reg-comment" className={labelCls}>
                Note for the committee
              </label>
              <textarea
                id="reg-comment"
                rows={2}
                value={form.comment}
                onChange={(e) => set({ comment: e.target.value })}
                className={`${inputCls} resize-none`}
                placeholder="Dietary needs, seating with another family, anything we should know"
              />
            </div>
            <label className="flex items-start gap-3 text-sm text-forest-ink/80">
              <input
                type="checkbox"
                checked={form.announcements}
                onChange={(e) => set({ announcements: e.target.checked })}
                className="mt-1 h-4 w-4 accent-forest"
              />
              Send me BPAU announcements by email
            </label>
          </div>

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

          <div className="border-t border-sand pt-6">
            <div className="flex items-center justify-between text-forest-ink lg:hidden">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-black text-forest">{money(estimate)}</span>
            </div>
            {error && (
              <p className="mt-4 rounded-xl bg-bengal-red/10 px-4 py-3 text-sm font-semibold text-bengal-red">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="cta-accent mt-4 w-full rounded-full py-4 font-heading text-base font-bold disabled:opacity-60"
            >
              {busy ? "Saving..." : "Get my payment code"}
            </button>
            <p className="mt-3 text-center text-xs text-muted-ink">
              No payment is taken here. You get a code, then pay by Zelle.
            </p>
          </div>
        </div>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-28">
        <div className="emerald-panel relative overflow-hidden rounded-3xl p-6 text-ivory">
          <Alpona className="floral-soft absolute -right-14 -top-14 h-44 w-44" />
          <div className="relative">
            <div className="text-xs font-semibold uppercase tracking-widest text-mint">
              Your total
            </div>
            <div className="mt-1 text-4xl font-black">{money(estimate)}</div>
            <ul className="mt-4 space-y-1.5 text-sm text-ivory-dim">
              {lines.length > 0 ? (
                lines.map((l) => <li key={l}>{l}</li>)
              ) : (
                <li>Choose who is coming to see the amount.</li>
              )}
            </ul>
            <div className="mt-5 border-t border-white/15 pt-4">
              <div className="flex items-center gap-2">
                <span className="glass-label text-xs uppercase tracking-widest">Pay with</span>
                <ZelleLogo size="sm" pill />
                <span className="glass-label text-xs uppercase tracking-widest">to</span>
              </div>
              <div className="mt-1 font-semibold text-ivory">
                {pricing.zelle_recipient || "Shown with your code"}
              </div>
              {pricing.zelle_recipient_name && (
                <div className="text-xs text-ivory-dim">
                  {pricing.zelle_recipient_name}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-sand bg-white p-6 shadow-sm">
          <SectionTitle>Prices</SectionTitle>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ["Adult", priceLabel(pricing.price_adult)],
              ["Child under 10", priceLabel(pricing.price_child)],
              ["Raffle draw coupon", money(pricing.coupon_single) + " each"],
              [
                `Bundle of ${pricing.coupon_bundle_qty} coupons`,
                money(pricing.coupon_bundle_price),
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4">
                <dt className="text-forest-ink/75">{k}</dt>
                <dd className="text-right font-semibold text-forest-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex items-start gap-2 border-t border-sand pt-4 text-xs text-muted-ink">
            <Icon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
            <p>
              Registration closes {pricing.registration_closes}. Send your Zelle
              soon after registering; unpaid codes expire.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
