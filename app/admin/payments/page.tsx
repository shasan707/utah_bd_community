"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { inputCls } from "@/components/admin/AdminShell";
import ActionDialog, {
  type DialogSpec,
} from "@/components/admin/payments/ActionDialog";
import AuditDrawer from "@/components/admin/payments/AuditDrawer";
import NewEntryForm from "@/components/admin/payments/NewEntryForm";
import RegistrationTable, {
  type RowAction,
} from "@/components/admin/payments/RegistrationTable";
import SettingsForm from "@/components/admin/payments/SettingsForm";
import { downloadText, registrationsCsv } from "@/components/admin/payments/csv";
import { adminRequest } from "@/lib/admin-api";
import { getSupabase } from "@/lib/supabase";
import { closesAt, formatDateOnly } from "@/lib/payments/dates";
import { money } from "@/lib/payments/pricing";
import {
  METHODS,
  parseRegistration,
  type RegistrationRow,
} from "@/lib/payments/types";

type Tab = "pending" | "all" | "settings";

type ServerStatus = {
  admin_email: string;
  service_configured: boolean;
  email_provider: string | null;
  cron_secret_set: boolean;
};

function Pill({ tone, children }: { tone: "good" | "warn" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "good"
      ? "bg-forest/10 text-forest"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800"
        : "bg-stone-200 text-stone-700";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{children}</span>
  );
}

export default function AdminPayments() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const [auditFor, setAuditFor] = useState<RegistrationRow | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [regs, sets] = await Promise.all([
      supabase
        .from("registrations")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("payment_settings").select("key,value"),
    ]);
    if (regs.error || sets.error) {
      setLoadError((regs.error || sets.error)?.message || "Could not load.");
      return;
    }
    setLoadError("");
    setRows((regs.data ?? []).map((r) => parseRegistration(r)));
    const map: Record<string, string> = {};
    for (const s of sets.data ?? []) map[String(s.key)] = String(s.value ?? "");
    setSettings(map);
    adminRequest<ServerStatus>("/api/admin/status", undefined, "GET")
      .then(setServer)
      .catch(() => setServer(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = useMemo(() => rows.filter((r) => r.status === "PENDING"), [rows]);
  const paid = useMemo(() => rows.filter((r) => r.status === "PAID"), [rows]);
  const collected = paid.reduce((s, r) => s + (r.amount_received ?? 0), 0);
  const expiredCount = rows.filter((r) => r.status === "EXPIRED").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.email.includes(q) ||
        r.phone.includes(q)
    );
  }, [rows, search]);

  const openLabel = (() => {
    if (settings.registration_open !== "true") return "Paused";
    if (Date.now() > closesAt(settings.registration_closes || "").getTime()) return "Closed";
    return "Open";
  })();

  const run = async (fn: () => Promise<{ message: string }>) => {
    const r = await fn();
    setMessage(r.message);
    await load();
  };

  const onAction = (action: RowAction, r: RegistrationRow) => {
    const patch = (body: Record<string, unknown>) =>
      adminRequest<{ message: string }>(
        `/api/admin/registrations/${encodeURIComponent(r.code)}`,
        body,
        "PATCH"
      );
    switch (action) {
      case "history":
        setAuditFor(r);
        break;
      case "mark_paid":
        setDialog({
          title: `Mark ${r.code} paid`,
          description: `${r.name}, ${money(r.amount_due)} due. A receipt is emailed if email is set up.`,
          confirmLabel: "Mark paid",
          fields: [
            {
              name: "method",
              label: "Payment method",
              type: "select",
              value: "zelle",
              options: METHODS.map((m) => ({ value: m, label: m })),
            },
            {
              name: "amount",
              label: "Amount received",
              type: "number",
              value: String(r.amount_due),
            },
            {
              name: "note",
              label: "Note (optional)",
              type: "text",
              placeholder: "Zelle confirmation, sender name, anything useful",
            },
          ],
          onConfirm: (v) =>
            run(() =>
              patch({
                action: "mark_paid",
                method: v.method,
                amount: Number(v.amount),
                note: v.note,
              })
            ),
        });
        break;
      case "void":
        setDialog({
          title: r.status === "PAID" ? `Refund ${r.code}` : `Void ${r.code}`,
          description:
            r.status === "PAID"
              ? "Marks the registration REFUNDED. Send the money back yourself; this only records it."
              : "Marks the registration CANCELLED. The code can no longer be paid.",
          confirmLabel: r.status === "PAID" ? "Mark refunded" : "Void",
          danger: true,
          fields: [
            { name: "reason", label: "Reason", type: "text", required: true },
          ],
          onConfirm: (v) => run(() => patch({ action: "void", reason: v.reason })),
        });
        break;
      case "adjust":
        setDialog({
          title: `Adjust amount for ${r.code}`,
          description: `Currently ${money(r.amount_due)}. Use this for discounts or corrections before payment.`,
          confirmLabel: "Save amount",
          fields: [
            {
              name: "amount",
              label: "New amount due",
              type: "number",
              value: String(r.amount_due),
              required: true,
            },
            { name: "note", label: "Why (optional)", type: "text" },
          ],
          onConfirm: (v) =>
            run(() =>
              patch({ action: "adjust_amount", amount: Number(v.amount), note: v.note })
            ),
        });
        break;
      case "resend":
        setDialog({
          title: `Resend receipt for ${r.code}`,
          description: `Sends the receipt again to ${r.email || "(no email on file)"}.`,
          confirmLabel: "Resend",
          fields: [],
          onConfirm: () => run(() => patch({ action: "resend_receipt" })),
        });
        break;
      case "merge":
        setDialog({
          title: `Merge ${r.code} into another code`,
          description: `${r.code} will be cancelled and noted as merged into the code you enter. Use this for duplicate submissions.`,
          confirmLabel: "Merge",
          fields: [
            {
              name: "keep_code",
              label: "Code to keep",
              type: "text",
              required: true,
              placeholder: "R-XXXX",
            },
          ],
          onConfirm: (v) =>
            run(() => patch({ action: "merge_into", keep_code: v.keep_code })),
        });
        break;
    }
  };

  const runExpiry = () =>
    run(async () => {
      const r = await adminRequest<{ expired: string[]; hours: number }>(
        "/api/cron/expire-pending",
        undefined,
        "GET"
      );
      return {
        message: r.expired.length
          ? `Expired ${r.expired.length}: ${r.expired.join(", ")}`
          : `Nothing to expire. Codes expire after ${r.hours} hours unpaid.`,
      };
    }).catch((err) => setMessage(err instanceof Error ? err.message : String(err)));

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`bpau-registrations-${stamp}.csv`, registrationsCsv(rows));
  };

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        tab === t ? "bg-forest-ink text-cream" : "bg-white text-forest-ink/70 hover:bg-cream-dim"
      }`}
    >
      {label}
    </button>
  );

  if (loadError) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-forest-ink">Payments</h1>
        <div className="mt-6 rounded-3xl border border-sand bg-white p-6">
          <p className="font-semibold text-forest-ink">
            The payment tables could not be read.
          </p>
          <p className="mt-1 text-sm text-forest-ink/70">
            If this is a fresh setup, run supabase/payments.sql in the Supabase
            SQL editor, then reload this page.
          </p>
          <p className="mt-3 text-xs text-forest-ink/50">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-ink">Payments</h1>
          <p className="mt-1 text-sm text-forest-ink/60">
            {settings.event_name || "Event"}
            {settings.registration_closes
              ? `, registration closes ${formatDateOnly(settings.registration_closes)}`
              : ""}
            . Every action here is written to the audit log.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone={openLabel === "Open" ? "good" : openLabel === "Paused" ? "muted" : "warn"}>
            Registration: {openLabel}
          </Pill>
          <Pill tone={server?.email_provider ? "good" : "warn"}>
            Email: {server ? server.email_provider ?? "not configured" : "..."}
          </Pill>
          {server && !server.cron_secret_set && (
            <Pill tone="warn">Cron secret missing</Pill>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-sand bg-white p-5">
          <div className="text-3xl font-black text-forest">{pending.length}</div>
          <div className="text-sm font-semibold text-forest-ink/70">waiting for payment</div>
        </div>
        <div className="rounded-3xl border border-sand bg-white p-5">
          <div className="text-3xl font-black text-forest">{paid.length}</div>
          <div className="text-sm font-semibold text-forest-ink/70">
            paid, {money(collected)} collected
          </div>
        </div>
        <div className="rounded-3xl border border-sand bg-white p-5">
          <div className="text-3xl font-black text-forest">{expiredCount}</div>
          <div className="text-sm font-semibold text-forest-ink/70">expired unpaid</div>
        </div>
      </div>

      {settings.registration_open === "true" && !settings.zelle_recipient?.trim() && (
        <p className="mt-4 rounded-2xl bg-bengal-red/10 px-5 py-3 text-sm font-medium text-bengal-red">
          Registration is open but the Zelle recipient is empty. Set it in
          Settings.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {tabBtn("pending", `Pending (${pending.length})`)}
        {tabBtn("all", `All registrations (${rows.length})`)}
        {tabBtn("settings", "Settings")}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="rounded-full border border-sand bg-white px-4 py-2 text-sm font-semibold text-forest-ink/80"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream"
          >
            New entry
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-full border border-sand bg-white px-4 py-2 text-sm font-semibold text-forest-ink/80"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={runExpiry}
            className="rounded-full border border-sand bg-white px-4 py-2 text-sm font-semibold text-forest-ink/80"
          >
            Run expiry now
          </button>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-2xl bg-forest/10 px-5 py-3 text-sm font-medium text-forest">
          {message}
        </p>
      )}

      <div className="mt-6">
        {tab === "pending" && (
          <RegistrationTable
            rows={pending}
            mode="pending"
            onAction={onAction}
            emptyText="Nobody is waiting for payment right now."
          />
        )}
        {tab === "all" && (
          <>
            <input
              placeholder="Search name, code, email, or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} mb-4 max-w-md`}
            />
            <RegistrationTable
              rows={filtered}
              mode="all"
              onAction={onAction}
              emptyText={search ? "No match." : "No registrations yet."}
            />
          </>
        )}
        {tab === "settings" && (
          <SettingsForm values={settings} onSaved={load} />
        )}
      </div>

      {dialog && <ActionDialog spec={dialog} onClose={() => setDialog(null)} />}
      {auditFor && <AuditDrawer row={auditFor} onClose={() => setAuditFor(null)} />}
      {showNew && (
        <NewEntryForm
          onDone={async (m) => {
            setMessage(m);
            await load();
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
