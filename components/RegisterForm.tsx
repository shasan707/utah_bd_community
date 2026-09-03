"use client";

import { useEffect, useState } from "react";
import { REGISTRATION_FORM_URL } from "@/lib/links";

type Pricing = {
  event_name: string;
  event_date: string;
  registration_closes: string;
  price_adult: number;
  price_child: number;
  price_student: number;
  coupon_single: number;
  coupon_bundle_qty: number;
  coupon_bundle_price: number;
  zelle_recipient: string;
  zelle_recipient_name: string;
  contact_email: string;
};

type Confirmation = {
  code: string;
  amount: string;
  zelle_recipient: string;
  zelle_recipient_name: string;
  breakdown: string[];
};

const inputCls =
  "w-full rounded-xl border border-sand bg-white px-4 py-3 text-forest-ink outline-none transition-colors focus:border-forest";
const labelCls = "mb-1.5 block text-sm font-semibold text-forest-ink";

export default function RegisterForm() {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    adults: 1,
    children: 0,
    ticket_type: "professional",
    coupons_qty: 0,
    donation: 0,
    comment: "",
    announcements: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Confirmation | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${REGISTRATION_FORM_URL}?api=pricing`)
      .then((r) => r.json())
      .then(setPricing)
      .catch(() => setPricing(null));
  }, []);

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  const couponCost = (qty: number, p: Pricing) => {
    const bundles = Math.floor(qty / p.coupon_bundle_qty);
    const singles = qty % p.coupon_bundle_qty;
    return bundles * p.coupon_bundle_price + singles * p.coupon_single;
  };

  const estimate = pricing
    ? form.adults *
        (form.ticket_type === "student"
          ? pricing.price_student
          : pricing.price_adult) +
      form.children * pricing.price_child +
      couponCost(form.coupons_qty, pricing) +
      Number(form.donation || 0)
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(REGISTRATION_FORM_URL, {
        method: "POST",
        body: JSON.stringify({ action: "register", payload: form }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Something went wrong.");
      setDone(data.result);
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
          <p className="mt-4 text-sm text-forest-ink/60">
            We emailed these instructions to you. You will receive a receipt by
            email once we confirm the payment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl">
      {pricing && (
        <p className="mb-6 text-center text-sm text-forest-ink/60">
          Event date: <b>{pricing.event_date}</b> · Registration closes:{" "}
          <b>{pricing.registration_closes}</b>
        </p>
      )}

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
              onChange={(e) => set({ adults: Number(e.target.value) })}
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
              onChange={(e) => set({ children: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Ticket type</label>
          <select
            value={form.ticket_type}
            onChange={(e) => set({ ticket_type: e.target.value })}
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
              onChange={(e) => set({ coupons_qty: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Donation ($)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.donation}
              onChange={(e) => set({ donation: Number(e.target.value) })}
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

        <div className="flex items-center justify-between rounded-2xl bg-cream-dim px-5 py-4 text-lg font-bold">
          <span>Total</span>
          <span className="text-forest">
            {estimate !== null
              ? `$${estimate.toFixed(2)}`
              : "shown after submitting"}
          </span>
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
