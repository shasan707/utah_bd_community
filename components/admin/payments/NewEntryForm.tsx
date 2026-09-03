"use client";

import { useState } from "react";
import { inputCls } from "@/components/admin/AdminShell";
import { adminRequest } from "@/lib/admin-api";
import { METHODS } from "@/lib/payments/types";

/** Walk-in or phone registration entered by the treasurer. */
export default function NewEntryForm({
  onDone,
  onClose,
}: {
  onDone: (message: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    adults: 1,
    children: 0,
    ticket_type: "professional",
    coupons_qty: 0,
    donation: 0,
    mark_paid_now: true,
    method: "cash",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await adminRequest<{ message: string }>(
        "/api/admin/registrations",
        form
      );
      await onDone(r.message);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest-ink/40 p-4"
      onClick={busy ? undefined : onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-forest-ink">New entry</h2>
        <p className="mt-1 text-sm text-forest-ink/60">
          For walk-ins and phone registrations. Only the name is required.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Full name"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className={`${inputCls} sm:col-span-2`}
          />
          <input
            placeholder="Phone"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Email (for the receipt)"
            type="email"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            className={inputCls}
          />
          <label className="text-sm font-semibold text-forest-ink">
            Adults
            <input
              type="number"
              min={0}
              max={50}
              value={form.adults}
              onChange={(e) => set({ adults: Number(e.target.value) || 0 })}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold text-forest-ink">
            Children (under 10)
            <input
              type="number"
              min={0}
              max={50}
              value={form.children}
              onChange={(e) => set({ children: Number(e.target.value) || 0 })}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold text-forest-ink">
            Ticket type
            <select
              value={form.ticket_type}
              onChange={(e) => set({ ticket_type: e.target.value })}
              className={`${inputCls} mt-1`}
            >
              <option value="professional">Professional</option>
              <option value="student">Student</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-forest-ink">
            Food coupons
            <input
              type="number"
              min={0}
              max={500}
              value={form.coupons_qty}
              onChange={(e) =>
                set({ coupons_qty: Number(e.target.value) || 0 })
              }
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold text-forest-ink">
            Donation
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.donation}
              onChange={(e) => set({ donation: Number(e.target.value) || 0 })}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="flex items-center gap-2 self-end text-sm text-forest-ink/80">
            <input
              type="checkbox"
              checked={form.mark_paid_now}
              onChange={(e) => set({ mark_paid_now: e.target.checked })}
            />
            Mark as paid now
          </label>
          {form.mark_paid_now && (
            <label className="text-sm font-semibold text-forest-ink sm:col-span-2">
              Payment method
              <select
                value={form.method}
                onChange={(e) => set({ method: e.target.value })}
                className={`${inputCls} mt-1`}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {error && (
          <p className="mt-3 text-sm font-medium text-bengal-red">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-sand px-4 py-2 text-sm font-semibold text-forest-ink/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-forest px-5 py-2 text-sm font-semibold text-cream disabled:opacity-60"
          >
            {busy ? "Saving..." : form.mark_paid_now ? "Create and mark paid" : "Create pending"}
          </button>
        </div>
      </form>
    </div>
  );
}
