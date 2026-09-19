"use client";

import { useEffect, useState } from "react";
import Alpona from "@/components/Alpona";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import Icon from "@/components/Icon";
import RegistrationTracker, { type TrackerStatus } from "@/components/RegistrationTracker";
import ZelleLogo from "@/components/ZelleLogo";
import VenmoLogo from "@/components/VenmoLogo";
import UsFlag from "@/components/UsFlag";
import {
  breakdownLines,
  bundleSize,
  computeAmount,
  DONATION_MIN,
  money,
  priceLabel,
  venmoLinks,
  type Pricing,
} from "@/lib/payments/pricing";

type Confirmation = {
  code: string;
  amount: string;
  amount_due: number;
  zelle_recipient: string;
  zelle_recipient_name: string;
  /** Blank when Venmo is not offered. */
  venmo_handle: string;
  venmo_name: string;
  breakdown: string[];
  email_sent: boolean;
  email_queued?: boolean;
  contact_email: string;
  reused?: boolean;
  /** Added to a code this person already had, rather than a new one. */
  added_to_existing?: boolean;
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
  youth: 0,
  children: 0,
  // The donation is off until it is deliberately switched on, so nobody
  // gives by accident. Held as text while typing, so the box can be cleared
  // without a zero jumping back into it.
  donate: false,
  donation_text: "",
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
  // The test switch is shown only to a signed-in admin who has opened
  // /register?test=1 on purpose, and only their token makes the server
  // honour it. A member never sees any of this, and neither does an admin
  // on an ordinary visit: the public form stays the public form.
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isTest, setIsTest] = useState(false);
  const [testRequested, setTestRequested] = useState(false);

  useEffect(() => {
    setStartedAt(Date.now());
    setTestRequested(new URLSearchParams(window.location.search).has("test"));
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setAdminToken(data.session?.access_token ?? null);
      })
      .catch(() => {
        /* not signed in, which is the normal case */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  // Bundles are just a faster way to pick coupons: the form adds them up and
  // the server prices the total, charging the bundle rate for every full ten.
  const totalCoupons =
    form.coupons_qty + form.bundles_qty * bundleSize(pricing);
  // Only counts once the box is ticked, so an amount left behind after
  // unticking is not charged.
  const donationTyped = Math.max(0, Number(form.donation_text) || 0);
  const donation = form.donate ? donationTyped : 0;
  // Ticked but not yet at the minimum. Blocks the button rather than letting
  // the server refuse after the fact.
  const donationShort = form.donate && donation < DONATION_MIN;

  const items = {
    adults: form.adults,
    youth: form.youth,
    children: form.children,
    coupons_qty: totalCoupons,
    donation,
  };
  const estimate = computeAmount(items, pricing);
  const lines = breakdownLines(items, pricing);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (donationShort) {
      setError(
        `A donation has to be at least ${money(DONATION_MIN)}. Please raise the amount, or untick the donation box.`
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const testing = isTest && adminToken !== null;
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(testing ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          coupons_qty: totalCoupons,
          donation,
          name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
          started_at: startedAt,
          ...(testing ? { test: true } : {}),
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
    const venmo = venmoLinks(done.venmo_handle, done.amount_due, done.code);
    const mailBody = [
      `Your code: ${done.code}`,
      `Amount: ${done.amount}`,
      `Send via Zelle to: ${done.zelle_recipient} (${done.zelle_recipient_name})`,
      ...(venmo
        ? [`Or via Venmo to @${done.venmo_handle}${done.venmo_name ? ` (${done.venmo_name})` : ""}: ${venmo.pay}`]
        : []),
      `Put ${done.code} in the memo/note field.`,
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
              {done.added_to_existing ? "Your existing code" : "Your payment code"}
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
            {done.added_to_existing && (
              <p className="mt-4 text-sm text-mint">
                We found your earlier registration, so this was added to the
                same code. The amount above is what is left to pay. Your
                existing ticket and QR code still work.
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
            {venmo && (
              <>
                <span className="text-base font-semibold text-muted-ink">or</span>
                <VenmoLogo size="md" />
              </>
            )}
          </h2>
          <ol className="mt-5 space-y-4">
            {[
              <>
                Open your bank app and choose <ZelleLogo size="sm" />
                {venmo && (
                  <>
                    , or open <VenmoLogo size="sm" /> (steps below)
                  </>
                )}
                .
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

          {venmo && (
            <div className="mt-6 rounded-2xl border border-[#008CFF]/30 bg-[#008CFF]/5 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#0074D4]">
                Or send it with <VenmoLogo size="sm" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-forest-ink/80">
                Same amount, same code. Pay{" "}
                <b className="text-forest-ink">@{done.venmo_handle}</b>
                {done.venmo_name && (
                  <span className="text-muted-ink"> ({done.venmo_name})</span>
                )}{" "}
                and put <b className="text-bengal-red">{done.code}</b> in the note.
              </p>
              <a
                href={venmo.pay}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-full bg-[#008CFF] px-5 py-2 text-sm font-bold text-white"
              >
                Open Venmo with the amount and note filled in
              </a>
              <p className="mt-2 text-xs text-muted-ink">
                If that does not open the app, go to{" "}
                <a href={venmo.profile} target="_blank" rel="noreferrer" className="font-semibold text-forest underline">
                  venmo.com/u/{done.venmo_handle}
                </a>{" "}
                and type them in.
              </p>
            </div>
          )}

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
                . Once your payment is confirmed you are in; bring your name or
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
                  placeholder="Mushfiqur"
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
                  placeholder="Rahman"
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
                hint={`16 and over, ${money(pricing.price_adult)} each`}
                value={form.adults}
                max={50}
                onChange={(v) => set({ adults: v })}
              />
              <Stepper
                label="Youth"
                hint={
                  pricing.price_youth > 0
                    ? `10 to 16, ${money(pricing.price_youth)} each`
                    : "10 to 16, free"
                }
                value={form.youth}
                max={50}
                onChange={(v) => set({ youth: v })}
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
            <SectionTitle>Donation</SectionTitle>
            <label className="flex items-start gap-3 text-sm text-forest-ink">
              <input
                type="checkbox"
                checked={form.donate}
                onChange={(e) => {
                  // Clearing the amount on untick means a number typed and
                  // then thought better of cannot come back with the box.
                  set(
                    e.target.checked
                      ? { donate: true }
                      : { donate: false, donation_text: "" }
                  );
                  setError("");
                }}
                className="mt-0.5 h-4 w-4 accent-forest"
              />
              <span>
                <span className="font-semibold">
                  I would like to add a donation
                </span>
                <span className="mt-0.5 block text-muted-ink">
                  Optional, and it goes towards running the day.
                </span>
              </span>
            </label>

            {form.donate && (
              <div>
                <label htmlFor="reg-donation" className={labelCls}>
                  Donation amount
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-forest-ink/50">
                    $
                  </span>
                  <input
                    id="reg-donation"
                    type="number"
                    inputMode="decimal"
                    min={DONATION_MIN}
                    step="1"
                    value={form.donation_text}
                    onChange={(e) => {
                      set({ donation_text: e.target.value });
                      setError("");
                    }}
                    aria-invalid={donationShort}
                    aria-describedby="reg-donation-help"
                    className={`${inputCls} pl-8 ${
                      donationShort ? "border-bengal-red" : ""
                    }`}
                    // A suggestion, not the floor: people give roughly what
                    // the box hints at, and the minimum is stated below.
                    placeholder="100"
                  />
                </div>
                <p
                  id="reg-donation-help"
                  className={
                    donationShort
                      ? "mt-1.5 text-sm font-semibold text-bengal-red"
                      : helpCls
                  }
                >
                  {donationShort
                    ? `Please enter at least ${money(DONATION_MIN)}, or untick the box above.`
                    : `${money(DONATION_MIN)} or more. Thank you.`}
                </p>
              </div>
            )}
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
          </div>

          {/* Honeypot: people never see this field, bots fill it in. The
              server rejects any submission where it is not empty. It carries
              no visible words at all, so nothing about it can surface. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0"
          >
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-label="Leave this field empty"
              value={form.website}
              onChange={(e) => set({ website: e.target.value })}
            />
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
            {/* No code is asked for while the donation is short of the
                minimum. The server refuses it too, for anyone who skips
                the form and posts to the API directly. */}
            <button
              type="submit"
              disabled={busy || donationShort}
              className="cta-accent mt-4 w-full rounded-full py-4 font-heading text-base font-bold disabled:opacity-60"
            >
              {busy
                ? "Saving..."
                : donationShort
                  ? `Donation must be ${money(DONATION_MIN)} or more`
                  : "Get my payment code"}
            </button>
            <p className="mt-3 text-center text-xs text-muted-ink">
              No payment is taken here. You get a code, then pay by Zelle
              {pricing.venmo_handle ? " or Venmo" : ""}.
            </p>
            {adminToken !== null && testRequested && (
              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-bengal-red/50 bg-bengal-red/5 px-4 py-3 text-sm text-forest-ink/80">
                <input
                  type="checkbox"
                  checked={isTest}
                  onChange={(e) => setIsTest(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <b className="text-bengal-red">Admin: this is a test.</b> Shown because you
                  are signed in and opened this page with ?test=1. The registration is made
                  exactly as a member&apos;s would be, including the email and text, but it is
                  hidden from the lists, never counted, and marked TEST at the desk and on
                  the ticket.
                </span>
              </label>
            )}
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
                {pricing.venmo_handle && (
                  <>
                    <span className="glass-label text-xs uppercase tracking-widest">or</span>
                    <VenmoLogo size="sm" pill />
                  </>
                )}
              </div>
              <div className="mt-2 glass-label text-xs uppercase tracking-widest">Zelle to</div>
              <div className="mt-1 font-semibold text-ivory">
                {pricing.zelle_recipient || "Shown with your code"}
              </div>
              {pricing.zelle_recipient_name && (
                <div className="text-xs text-ivory-dim">
                  {pricing.zelle_recipient_name}
                </div>
              )}
              {pricing.venmo_handle && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <span className="glass-label text-xs uppercase tracking-widest">Venmo to</span>
                  <div className="mt-1 font-semibold text-ivory">@{pricing.venmo_handle}</div>
                  {pricing.venmo_name && (
                    <div className="text-xs text-ivory-dim">{pricing.venmo_name}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-sand bg-white p-6 shadow-sm">
          <SectionTitle>Prices</SectionTitle>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ["Adult, 16 and over", priceLabel(pricing.price_adult)],
              ["Youth, 10 to 16", priceLabel(pricing.price_youth)],
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
              {pricing.venmo_handle ? " or Venmo" : ""} soon after registering; unpaid
              codes expire.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
