"use client";

import { useEffect, useState } from "react";
import { inputCls } from "@/components/admin/AdminShell";
import { getSupabase } from "@/lib/supabase";

type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "email";
  help?: string;
};

const groups: { title: string; fields: Field[] }[] = [
  {
    title: "Event",
    fields: [
      { key: "event_name", label: "Event name", type: "text" },
      { key: "event_date", label: "Event date", type: "date" },
      {
        key: "registration_closes",
        label: "Registration closes",
        type: "date",
        help: "Last day people can register, end of day Utah time.",
      },
      {
        key: "pending_expiry_hours",
        label: "Unpaid codes expire after (hours)",
        type: "number",
      },
    ],
  },
  {
    title: "Prices",
    fields: [
      { key: "price_adult", label: "Adult (professional)", type: "number" },
      { key: "price_student", label: "Student", type: "number" },
      { key: "price_child", label: "Child (under 10)", type: "number" },
      { key: "coupon_single", label: "One food coupon", type: "number" },
      { key: "coupon_bundle_qty", label: "Coupons in a bundle", type: "number" },
      { key: "coupon_bundle_price", label: "Bundle price", type: "number" },
    ],
  },
  {
    title: "Zelle and contact",
    fields: [
      {
        key: "zelle_recipient",
        label: "Zelle recipient (email or phone people send to)",
        type: "text",
        help: "Must be the alias enrolled in Zelle at the bank.",
      },
      {
        key: "zelle_recipient_name",
        label: "Name shown by Zelle for that recipient",
        type: "text",
      },
      {
        key: "contact_email",
        label: "Contact email (reply-to on emails)",
        type: "email",
      },
    ],
  },
];

export default function SettingsForm({
  values,
  onSaved,
}: {
  values: Record<string, string>;
  onSaved: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<Record<string, string>>(values);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm(values);
  }, [values]);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const changed = Object.entries(form)
      .filter(([k, v]) => (values[k] ?? "") !== v)
      .map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
      }));
    if (changed.length === 0) {
      setMessage("Nothing changed.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await getSupabase()
      .from("payment_settings")
      .upsert(changed, { onConflict: "key" });
    if (error) {
      setMessage(`Save failed: ${error.message}`);
    } else {
      setMessage("Settings saved. The public pages pick this up within a minute.");
      await onSaved();
    }
    setBusy(false);
  };

  const open = form.registration_open === "true";

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-3xl border border-sand bg-white p-6">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={open}
            onChange={(e) =>
              set("registration_open", e.target.checked ? "true" : "false")
            }
            className="mt-1"
          />
          <span>
            <span className="block font-bold text-forest-ink">
              Registration is open
            </span>
            <span className="block text-sm text-forest-ink/60">
              When off, the Register page shows a "not open yet" card and the
              Register buttons disappear from the site. Registration also closes
              by itself after the closing date below.
            </span>
          </span>
        </label>
        <label className="mt-5 flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.auto_confirm === "true"}
            onChange={(e) =>
              set("auto_confirm", e.target.checked ? "true" : "false")
            }
            className="mt-1"
          />
          <span>
            <span className="block font-bold text-forest-ink">
              Auto-confirm Zelle payments
            </span>
            <span className="block text-sm text-forest-ink/60">
              When on, a bank alert whose memo matches a code marks that
              registration PAID and emails the receipt with no click from you.
              When off, the alerts are still recorded and matched on the Zelle
              tab, but nothing is confirmed until you click. Keep it off for the
              first week and watch the matches.
            </span>
          </span>
        </label>
        {open && !form.zelle_recipient?.trim() && (
          <p className="mt-3 rounded-xl bg-bengal-red/10 px-4 py-2 text-sm font-medium text-bengal-red">
            The Zelle recipient is empty. Members will be told to send money to
            nowhere. Fill it in below before opening.
          </p>
        )}
      </div>

      {groups.map((g) => (
        <div key={g.title} className="rounded-3xl border border-sand bg-white p-6">
          <h3 className="font-bold text-forest-ink">{g.title}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => (
              <label key={f.key} className="block text-sm font-semibold text-forest-ink">
                {f.label}
                <input
                  type={f.type}
                  step={f.type === "number" ? "0.01" : undefined}
                  min={f.type === "number" ? 0 : undefined}
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className={`${inputCls} mt-1`}
                />
                {f.help && (
                  <span className="mt-1 block text-xs font-normal text-forest-ink/50">
                    {f.help}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-forest px-7 py-3 font-semibold text-cream disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save settings"}
        </button>
        {message && (
          <p className="text-sm font-medium text-forest">{message}</p>
        )}
      </div>
    </form>
  );
}
