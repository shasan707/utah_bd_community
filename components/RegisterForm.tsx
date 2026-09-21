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
  // The donation is on by default at the minimum, the committee's choice:
  // the total shows it from the first second, so nobody is surprised, and
  // one tap turns it off. Held as text while typing, so the box can be
  // cleared without a zero jumping back into it.
  donate: true,
  donation_text: String(DONATION_MIN),
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
  // The payment checklist on the confirmation screen: which of its four
  // steps the person has ticked, whether they copied the Zelle address, and
  // whether they told us the money is on its way.
  const [stepDone, setStepDone] = useState<boolean[]>([false, false, false, false]);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [claimedSent, setClaimedSent] = useState(false);

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
      setStepDone((d) => [true, d[1], d[2], d[3]]);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const copyAddress = async () => {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.zelle_recipient);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const tick = (i: number) =>
    setStepDone((d) => d.map((v, k) => (k === i ? !v : v)));

  const reset = () => {
    setDone(null);
    setDoneEmail("");
    setLive(null);
    setForm(emptyForm);
    setStartedAt(Date.now());
    setStepDone([false, false, false, false]);
    setCopiedAddr(false);
    setClaimedSent(false);
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
            How to pay, step by step
          </h2>
          <p className="mt-1 text-sm text-muted-ink">
            Tick each step as you go. The code in the memo is the one people
            forget, and it is how we know the money is yours.
          </p>

          {/* The checklist follows the person into the bank app, in the
              order things happen there: copy the code first, because Zelle
              has no way to fill it in for them, and the memo is last because
              it is the last thing they do before pressing Send. */}
          <ol className="mt-5 space-y-3">
            {[
              {
                title: "Copy your code",
                body: (
                  <>
                    <span className="font-heading text-2xl font-black tracking-[0.15em] text-forest-ink">
                      {done.code}
                    </span>
                    <button
                      type="button"
                      onClick={copyCode}
                      className="ml-3 rounded-full bg-forest px-4 py-1.5 text-sm font-bold text-ivory"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <span className="mt-1 block text-sm text-muted-ink">
                      You will paste it into the memo in step 4.
                    </span>
                  </>
                ),
              },
              {
                title: "Open your bank app and choose Zelle",
                body: (
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted-ink">
                    <ZelleLogo size="sm" />
                    {venmo && (
                      <>
                        <span>or, fastest on a phone,</span>
                        <a
                          href={venmo.pay}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setStepDone([true, true, true, true])}
                          className="inline-flex items-center gap-2 rounded-full bg-[#008CFF] px-4 py-1.5 text-sm font-bold text-white"
                        >
                          Open <VenmoLogo size="sm" onDark /> with everything filled in
                        </a>
                      </>
                    )}
                  </span>
                ),
              },
              {
                title: `Send exactly ${done.amount}`,
                body: (
                  <>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-ink">to</span>
                      <b className="font-mono text-base text-forest-ink">{done.zelle_recipient}</b>
                      <button
                        type="button"
                        onClick={copyAddress}
                        className="rounded-full border border-sand px-3 py-1 text-xs font-semibold text-forest"
                      >
                        {copiedAddr ? "Copied" : "Copy address"}
                      </button>
                    </span>
                    {done.zelle_recipient_name && (
                      <span className="mt-1 block text-sm text-muted-ink">
                        Zelle will show the name <b className="text-forest-ink">{done.zelle_recipient_name}</b>.
                        That is us.
                      </span>
                    )}
                    {venmo && (
                      <span className="mt-1 block text-sm text-muted-ink">
                        On Venmo: <b className="text-forest-ink">@{done.venmo_handle}</b>
                        {done.venmo_name ? ` (${done.venmo_name})` : ""}.
                      </span>
                    )}
                  </>
                ),
              },
              {
                title: "Paste the code in the memo box, then send",
                body: (
                  <>
                    {/* What the memo box looks like with the code in it, so
                        they recognise the field when they see it. */}
                    <span className="mt-1 block max-w-xs rounded-xl border-2 border-dashed border-bengal-red/50 bg-cream px-4 py-2 text-left">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-ink">
                        What&apos;s this for? · Memo · Note
                      </span>
                      <span className="block font-mono text-lg font-bold text-bengal-red">
                        {done.code}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-muted-ink">
                      This is how we match the payment to you. Please do not skip it.
                    </span>
                  </>
                ),
              },
            ].map((step, i) => (
              <li
                key={step.title}
                className={`flex items-start gap-4 rounded-2xl border px-4 py-3 transition-colors ${
                  stepDone[i] ? "border-forest/30 bg-forest/5" : "border-sand bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => tick(i)}
                  aria-pressed={stepDone[i]}
                  aria-label={`${stepDone[i] ? "Undo" : "Done"}: ${step.title}`}
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-heading text-sm font-black transition-colors ${
                    stepDone[i] ? "bg-forest text-ivory" : "border-2 border-forest/40 text-forest"
                  }`}
                >
                  {stepDone[i] ? <Icon name="check" className="h-4 w-4" /> : i + 1}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`font-semibold ${stepDone[i] ? "text-forest" : "text-forest-ink"}`}>
                    {step.title}
                  </div>
                  <div className="mt-1">{step.body}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 text-center">
            {claimedSent ? (
              <p className="rounded-2xl bg-forest/10 px-5 py-3 text-sm font-semibold text-forest">
                Thank you. We are watching for it; this page updates by itself and your
                ticket follows by email the moment it lands.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setClaimedSent(true);
                  setStepDone([true, true, true, true]);
                }}
                className="cta-accent rounded-full px-8 py-3 font-heading text-base font-bold"
              >
                I have sent it
              </button>
            )}
          </div>

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

          <div className="border-t border-sand pt-8">
            {/* Centred and on by default, the committee's choice. The three
                quick amounts are what most people give; "other" is the box.
                One tap on the switch turns it all off. */}
            <div className="mx-auto max-w-md text-center">
              <SectionTitle>Donation</SectionTitle>
              <p className="mt-2 text-sm text-forest-ink/80">
                Your donation covers the park, the food and the children&apos;s games.
              </p>
              <label className="mt-4 inline-flex items-center gap-3 rounded-full border border-sand bg-cream px-4 py-2 text-sm font-semibold text-forest-ink">
                <input
                  type="checkbox"
                  checked={form.donate}
                  onChange={(e) => {
                    // Clearing the amount on untick means a number typed and
                    // then thought better of cannot come back with the box.
                    set(
                      e.target.checked
                        ? { donate: true, donation_text: String(DONATION_MIN) }
                        : { donate: false, donation_text: "" }
                    );
                    setError("");
                  }}
                  className="h-4 w-4 accent-forest"
                />
                {form.donate ? "Adding a donation" : "No donation this time"}
              </label>

              {form.donate && (
                <div className="mt-4">
                  <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Donation amount">
                    {[50, 100, 200].map((n) => {
                      const on = Number(form.donation_text) === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            set({ donation_text: String(n) });
                            setError("");
                          }}
                          aria-pressed={on}
                          className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${
                            on
                              ? "bg-forest text-ivory"
                              : "border border-sand bg-white text-forest-ink hover:bg-cream"
                          }`}
                        >
                          {money(n)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative mx-auto mt-3 max-w-[12rem]">
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
                      aria-label="Other amount"
                      aria-invalid={donationShort}
                      aria-describedby="reg-donation-help"
                      className={`${inputCls} pl-8 text-center ${
                        donationShort ? "border-bengal-red" : ""
                      }`}
                      placeholder="Other"
                    />
                  </div>
                  <p
                    id="reg-donation-help"
                    className={
                      donationShort
                        ? "mt-1.5 text-sm font-semibold text-bengal-red"
                        : "mt-1.5 text-xs text-muted-ink"
                    }
                  >
                    {donationShort
                      ? `Please enter at least ${money(DONATION_MIN)}, or switch the donation off above.`
                      : `${money(DONATION_MIN)} or more. Thank you.`}
                  </p>
                </div>
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
        {/* Nothing blank while the code is being made: the form dims, the
            message says what is happening, and the button below is already
            disabled. Gone the moment the confirmation screen replaces it. */}
        {busy && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-3xl bg-white/80 backdrop-blur-sm"
          >
            <span
              aria-hidden="true"
              className="h-10 w-10 animate-spin rounded-full border-4 border-sand border-t-forest"
            />
            <p className="mt-4 font-heading text-lg font-black text-forest-ink">
              Creating your code…
            </p>
            <p className="mt-1 text-sm text-muted-ink">
              A few seconds. Your payment steps come next.
            </p>
          </div>
        )}
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
                <ZelleLogo size="sm" glass />
                {pricing.venmo_handle && (
                  <>
                    <span className="glass-label text-xs uppercase tracking-widest">or</span>
                    <VenmoLogo size="sm" glass />
                  </>
                )}
              </div>
              <div className="mt-2 glass-label text-xs uppercase tracking-widest">Zelle to</div>
              <div className="mt-1 font-semibold text-ivory">
                {pricing.zelle_recipient || "Shown with your code"}
              </div>
              {pricing.zelle_recipient_name && (
                <div className="text-xs text-ivory-dim">
                  Zelle shows the name {pricing.zelle_recipient_name}
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
