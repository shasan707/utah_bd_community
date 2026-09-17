"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { inputCls } from "@/components/admin/AdminShell";
import Scanner from "@/components/admin/checkin/Scanner";
import { adminRequest } from "@/lib/admin-api";
import { headcount, money, outstanding } from "@/lib/payments/pricing";
import { parseScannedTicket } from "@/lib/payments/ticket-parse";
import { parseRegistration, type RegistrationRow } from "@/lib/payments/types";
import { getSupabase } from "@/lib/supabase";

type Outcome =
  | "checked_in"
  | "already"
  | "coupons_only"
  | "nothing_to_admit"
  | "collected"
  | "already_collected"
  | "no_coupons"
  | "not_paid"
  | "unknown"
  | "invalid"
  | "undone";
type Result = { outcome: Outcome; message: string; row: RegistrationRow | null };

const REPEAT_MS = 5000;

function party(r: RegistrationRow): string {
  const bits: string[] = [];
  if (r.adults) bits.push(`${r.adults} adult${r.adults === 1 ? "" : "s"}`);
  if (r.youth) bits.push(`${r.youth} youth`);
  if (r.children) bits.push(`${r.children} child${r.children === 1 ? "" : "ren"}`);
  if (r.coupons_qty) bits.push(`${r.coupons_qty} coupon${r.coupons_qty === 1 ? "" : "s"}`);
  if (r.donation > 0) bits.push(`$${r.donation} donation`);
  return bits.length ? bits.join(" · ") : "nothing";
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const TONES: Record<Outcome, string> = {
  checked_in: "bg-forest text-cream",
  collected: "bg-forest text-cream",
  already: "bg-amber-100 text-amber-900",
  already_collected: "bg-amber-100 text-amber-900",
  coupons_only: "bg-amber-100 text-amber-900",
  nothing_to_admit: "bg-amber-100 text-amber-900",
  no_coupons: "bg-amber-100 text-amber-900",
  not_paid: "bg-bengal-red text-white",
  unknown: "bg-bengal-red text-white",
  invalid: "bg-bengal-red text-white",
  undone: "bg-stone-200 text-stone-800",
};

const TITLES: Record<Outcome, string> = {
  checked_in: "Welcome",
  collected: "Coupons handed over",
  already: "Already in",
  already_collected: "Coupons already collected",
  coupons_only: "Coupons only, no entry",
  nothing_to_admit: "Donation only, no entry",
  no_coupons: "No coupons on this code",
  not_paid: "Not paid",
  unknown: "Unknown code",
  invalid: "Not our QR",
  undone: "Undone",
};

/**
 * The desk. A volunteer signs in once, starts the camera, and points it at
 * each code. Two things are handed over and each has its own stamp: entry,
 * one wristband per person on the row, and the raffle coupons on the row.
 *
 * A person is their phone number. One person may hold several codes, a
 * ticket bought one day and coupons another, so every code is shown with
 * the others that share its phone, and the volunteer sees everything owed
 * to that person on one screen whichever code they were shown.
 */
export default function AdminCheckin() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState("");
  const [reassigning, setReassigning] = useState<string | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("registrations")
      .select("*")
      .in("status", ["PAID", "PENDING", "EXPIRED"])
      .order("name");
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError("");
    setRows((data ?? []).map((r) => parseRegistration(r)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = useCallback(
    async (body: Record<string, unknown>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError("");
      try {
        const res = await adminRequest<Result>("/api/admin/checkin", body);
        setResult(res);
        if (
          (res.outcome === "checked_in" || res.outcome === "collected") &&
          typeof navigator.vibrate === "function"
        ) {
          navigator.vibrate(120);
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed.");
      }
      busyRef.current = false;
      setBusy(false);
    },
    [load]
  );

  const reassign = useCallback(
    async (code: string, to: { name: string; phone: string; email: string }) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError("");
      try {
        const res = await adminRequest<{ message: string }>(
          `/api/admin/registrations/${encodeURIComponent(code)}`,
          { action: "reassign", ...to },
          "PATCH"
        );
        setNotice(res.message);
        setReassigning(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed.");
      }
      busyRef.current = false;
      setBusy(false);
    },
    [load]
  );

  const onDecode = useCallback(
    (text: string) => {
      const now = Date.now();
      if (lastRef.current.text === text && now - lastRef.current.at < REPEAT_MS) return;
      lastRef.current = { text, at: now };
      const parsed = parseScannedTicket(text);
      if (!parsed) {
        setResult({ outcome: "invalid", message: "That QR is not one of our tickets.", row: null });
        return;
      }
      run({ code: parsed.code, token: parsed.token });
    },
    [run]
  );

  const paid = useMemo(() => rows.filter((r) => r.status === "PAID"), [rows]);
  const tickets = useMemo(() => paid.filter((r) => headcount(r) > 0), [paid]);
  const arrived = useMemo(() => tickets.filter((r) => r.checked_in_at), [tickets]);
  const peopleIn = arrived.reduce((n, r) => n + headcount(r), 0);
  const couponsSold = paid.reduce((n, r) => n + r.coupons_qty, 0);
  const couponsOut = paid.reduce((n, r) => n + (r.coupons_collected_at ? r.coupons_qty : 0), 0);

  // Everything one phone number holds. A row with no phone stands alone.
  const byPhone = useMemo(() => {
    const m = new Map<string, RegistrationRow[]>();
    for (const r of rows) {
      const key = r.phone || `code:${r.code}`;
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return m;
  }, [rows]);
  const siblings = (r: RegistrationRow) =>
    (byPhone.get(r.phone || `code:${r.code}`) ?? []).filter((x) => x.code !== r.code);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows.slice(0, 40);
    const digits = q.replace(/\D/g, "");
    return rows
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.code.replace("-", "").toLowerCase().includes(q.replace("-", "")) ||
          (digits.length >= 3 && r.phone.includes(digits)) ||
          r.email.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [rows, search]);

  const needsSql = /checked_in|coupons_collected/i.test(`${loadError} ${error}`);
  const sqlFile = /coupons_collected/i.test(`${loadError} ${error}`)
    ? "supabase/coupons_collected.sql"
    : "supabase/checkin.sql";

  /** One row's two stamps, each with its button. */
  const controls = (r: RegistrationRow) => {
    const isPaid = r.status === "PAID";
    const seats = headcount(r);
    const owed = outstanding(r);
    if (!isPaid) {
      return (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          {r.status}, not paid
        </span>
      );
    }
    // Owing money holds everything back, wristbands included, so the desk
    // never hands out half of an order. Take the balance on the Payments
    // page and the buttons come back.
    if (owed > 0) {
      return (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          {money(owed)} owing, take payment first
        </span>
      );
    }
    return (
      <>
        {seats > 0 &&
          (r.checked_in_at ? (
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-forest">
              in at {clock(r.checked_in_at)}
              <button
                type="button"
                disabled={busy}
                onClick={() => run({ code: r.code, action: "undo" })}
                className="rounded-full border border-sand px-3 py-1 text-xs font-semibold text-forest-ink/80 disabled:opacity-60"
              >
                Undo
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => run({ code: r.code })}
              className="rounded-full bg-forest px-4 py-1.5 text-xs font-bold text-cream disabled:opacity-60"
            >
              {seats} wristband{seats === 1 ? "" : "s"}
            </button>
          ))}
        {r.coupons_qty > 0 &&
          (r.coupons_collected_at ? (
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-forest">
              coupons out at {clock(r.coupons_collected_at)}
              <button
                type="button"
                disabled={busy}
                onClick={() => run({ code: r.code, action: "undo_collect" })}
                className="rounded-full border border-sand px-3 py-1 text-xs font-semibold text-forest-ink/80 disabled:opacity-60"
              >
                Undo
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => run({ code: r.code, action: "collect" })}
              className="rounded-full border-2 border-forest px-4 py-1.5 text-xs font-bold text-forest disabled:opacity-40"
            >
              Hand over {r.coupons_qty} coupon{r.coupons_qty === 1 ? "" : "s"}
            </button>
          ))}
        {r.donation > 0 && (
          <span className="text-xs font-semibold text-forest-ink/60">say thank you</span>
        )}
        {r.donation === 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setReassigning(reassigning === r.code ? null : r.code)}
            className="text-xs font-semibold text-forest-ink/60 underline decoration-forest-ink/30 underline-offset-2"
          >
            Reassign
          </button>
        )}
      </>
    );
  };

  /** A card for one registration, with its controls and its phone-mates. */
  const card = (r: RegistrationRow, opts?: { withSiblings?: boolean }) => (
    <div key={r.code} className="rounded-2xl border border-sand bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-forest-ink">{r.name}</div>
          <div className="truncate text-xs text-forest-ink/50">
            <span className="font-mono">{r.code}</span> · {party(r)}
            {r.phone ? ` · ${r.phone}` : ""}
          </div>
        </div>
        {controls(r)}
      </div>
      {reassigning === r.code && (
        <ReassignForm
          row={r}
          busy={busy}
          onCancel={() => setReassigning(null)}
          onSubmit={(to) => reassign(r.code, to)}
        />
      )}
      {opts?.withSiblings && siblings(r).length > 0 && (
        <div className="mt-3 border-t border-sand pt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-forest">
            Same phone number
          </div>
          <div className="space-y-2">{siblings(r).map((x) => card(x))}</div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-forest-ink">The desk</h1>
          <p className="mt-1 text-forest-ink/60">
            Scan a code. Green means hand it over: wristbands for tickets, coupons for
            coupons. Everything one phone number holds is shown together.
          </p>
        </div>
        <div className="rounded-2xl border border-sand bg-white px-5 py-3 text-sm">
          <b className="text-forest">{arrived.length}</b> of <b>{tickets.length}</b> tickets in ·{" "}
          <b className="text-forest">{peopleIn}</b> people arrived ·{" "}
          <b className="text-forest">{couponsOut}</b> of <b>{couponsSold}</b> coupons out
        </div>
      </div>

      {needsSql && (
        <p className="mt-4 rounded-2xl bg-bengal-red/10 px-5 py-3 text-sm font-medium text-bengal-red">
          A column is missing. Run {sqlFile} in the Supabase SQL editor once.
        </p>
      )}
      {loadError && !needsSql && (
        <p className="mt-4 rounded-2xl bg-bengal-red/10 px-5 py-3 text-sm font-medium text-bengal-red">
          {loadError}
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded-2xl bg-forest/10 px-5 py-3 text-sm font-medium text-forest">
          {notice}{" "}
          <button type="button" onClick={() => setNotice("")} className="underline">
            ok
          </button>
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Scanner active={scanning} onDecode={onDecode} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setScanning((v) => !v)}
              className={`rounded-full px-6 py-2.5 text-sm font-bold ${
                scanning ? "border border-bengal-red text-bengal-red" : "bg-forest text-cream"
              }`}
            >
              {scanning ? "Stop camera" : "Start camera"}
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!manual.trim()) return;
                const parsed = parseScannedTicket(manual);
                if (parsed) run({ code: parsed.code, token: parsed.token });
                else setError("Type a code like R-7X3M.");
                setManual("");
              }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="or type a code, R-7X3M"
                className={`${inputCls} font-mono uppercase`}
                autoCapitalize="characters"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full border border-forest px-4 py-2.5 text-sm font-semibold text-forest disabled:opacity-60"
              >
                Go
              </button>
            </form>
          </div>
        </div>

        <div>
          {result ? (
            <div className={`rounded-3xl p-6 ${TONES[result.outcome]}`}>
              <div className="text-xs font-bold uppercase tracking-[0.25em] opacity-80">
                {TITLES[result.outcome]}
              </div>
              {result.row && (
                <div className="mt-2 text-3xl font-black leading-tight">{result.row.name}</div>
              )}
              {result.row && result.outcome !== "unknown" && (
                <div className="mt-2 text-xl font-bold">{party(result.row)}</div>
              )}
              <p className="mt-3 text-sm opacity-90">{result.message}</p>
              {result.row && (
                <div className="mt-1 font-mono text-sm opacity-80">{result.row.code}</div>
              )}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="rounded-full bg-white/90 px-5 py-2 text-sm font-bold text-forest-ink"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-sand p-6 text-sm text-forest-ink/60">
              {busy ? "Checking..." : "The result of the last scan shows here."}
            </div>
          )}
          {error && (
            <p className="mt-3 rounded-2xl bg-bengal-red/10 px-4 py-3 text-sm font-medium text-bengal-red">
              {error}
            </p>
          )}
          {result?.row && (
            <div className="mt-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-forest">
                This person
              </div>
              {card(
                rows.find((r) => r.code === result.row?.code) ?? result.row,
                { withSiblings: true }
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-bold text-forest-ink">Find by name or phone</h2>
        <p className="mt-1 text-sm text-forest-ink/60">
          For walk-ins, dead phones, a code they cannot find, and cash at the door. Unpaid
          people pay first on the Payments page, then come back here.
        </p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, code, phone, or email"
          className={`${inputCls} mt-4`}
        />
        <div className="mt-4 space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-forest-ink/50">Nobody matches.</p>
          )}
          {filtered.map((r) => card(r, { withSiblings: search.trim().length > 0 }))}
        </div>
      </div>
    </div>
  );
}

/** Who a ticket is handed to when the person who paid cannot come. */
function ReassignForm({
  row,
  busy,
  onCancel,
  onSubmit,
}: {
  row: RegistrationRow;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (to: { name: string; phone: string; email: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({ name: name.trim(), phone, email });
      }}
      className="mt-3 grid gap-2 border-t border-sand pt-3 sm:grid-cols-3"
    >
      <p className="text-xs text-forest-ink/60 sm:col-span-3">
        {row.name} paid but cannot come. Who is using {row.code} instead? What was bought
        and paid does not change; the ticket is emailed to the new person.
      </p>
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New holder's name"
        className={inputCls}
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Their phone"
        inputMode="tel"
        className={inputCls}
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Their email, for the ticket"
        inputMode="email"
        className={inputCls}
      />
      <div className="flex gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-full bg-forest px-4 py-1.5 text-xs font-bold text-cream disabled:opacity-60"
        >
          Reassign
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-sand px-4 py-1.5 text-xs font-semibold text-forest-ink/80"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
