import "server-only";
import { ApiError, getServiceClient } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/email";
import { audit } from "./audit";
import { CODE_ALPHABET } from "./codes";
import { money, roundCents } from "./pricing";
import { appendNote, deliverReceipt, getRegistration } from "./registrations";
import { getSettings, type Settings } from "./settings";
import { parseZelleEmail, type ParsedZelle } from "./zelle-parse";
import {
  parsePayment,
  parseRegistration,
  type MatchStatus,
  type PaymentRow,
  type PaymentSource,
  type RegistrationRow,
} from "./types";

/**
 * Zelle transactions: parsing the bank's alert email, matching the code in
 * the memo to a registration, and confirming it. This is the automatic part
 * of the process. The Gmail account only relays the emails here; every
 * decision is made and logged on this side.
 */

const PAYMENTS = "payments";
const RAW = "raw_emails";
const MAX_BODY = 40_000;

export { parseZelleEmail, type ParsedZelle } from "./zelle-parse";

/**
 * Every 4 and 5 character window of the memo with spaces and punctuation
 * removed, so "for r7x3m please", "R-7X3M" and "7x3m" all find the code.
 */
export function extractCandidates(memo: string): Set<string> {
  const clean = String(memo).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ok = (ch: string) => CODE_ALPHABET.includes(ch);
  const out = new Set<string>();
  for (let i = 0; i + 4 <= clean.length; i++) {
    const four = clean.slice(i, i + 4);
    if ([...four].every(ok)) out.add(four);
    if (i + 5 <= clean.length) {
      const five = clean.slice(i, i + 5);
      if ("RCD".includes(five[0]) && [...five.slice(1)].every(ok)) out.add(five);
    }
  }
  return out;
}

function cents(n: number): number {
  return Math.round(n * 100);
}

async function notifyAdmins(s: Settings, subject: string, text: string): Promise<void> {
  if (!s.contact_email) return;
  await sendEmail({
    to: s.contact_email,
    subject: `[BPAU system] ${subject}`,
    text,
    kind: "admin",
  });
}

export async function getPayment(id: number): Promise<PaymentRow> {
  const { data, error } = await getServiceClient()
    .from(PAYMENTS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, `Payment ${id} not found.`);
  return parsePayment(data);
}

async function patchPayment(
  id: number,
  patch: Record<string, unknown>
): Promise<PaymentRow> {
  const { data, error } = await getServiceClient()
    .from(PAYMENTS)
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, `Payment ${id} not found.`);
  return parsePayment(data);
}

/* ------------------------------------------------------------------ */
/* Record                                                              */
/* ------------------------------------------------------------------ */

/**
 * Saves one transaction and decides how it matches. Never confirms anything
 * by itself; that is applyPayment's job, gated by the auto_confirm setting.
 */
export async function recordPayment(
  parsed: ParsedZelle,
  receivedAt: string,
  source: PaymentSource,
  messageId: string | null,
  s: Settings
): Promise<PaymentRow> {
  const db = getServiceClient();
  const record: Record<string, unknown> = {
    confirmation_id: parsed.confirmation.slice(0, 100),
    received_at: receivedAt,
    sender_name: parsed.sender_name.slice(0, 200),
    amount: roundCents(parsed.amount),
    memo_raw: parsed.memo_raw.slice(0, 500),
    memo_normalized: parsed.memo_raw
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, "")
      .slice(0, 500),
    extracted_code: "",
    match_status: "UNMATCHED" as MatchStatus,
    linked_code: null,
    suggested_code: null,
    processed_at: null,
    source,
    message_id: messageId,
  };

  const dup = await db
    .from(PAYMENTS)
    .select("id", { count: "exact", head: true })
    .eq("confirmation_id", record.confirmation_id as string)
    .neq("match_status", "DUPLICATE");
  if ((dup.count ?? 0) > 0) {
    record.match_status = "DUPLICATE";
    return insertPayment(record);
  }

  const { data: pend, error } = await db
    .from("registrations")
    .select("*")
    .in("status", ["PENDING", "EXPIRED"]);
  if (error) throw new ApiError(500, error.message);
  const open = (pend ?? []).map((r) => parseRegistration(r));

  const candidates = extractCandidates(parsed.memo_raw);
  let matches = open.filter((r) => candidates.has(r.code.replace("-", "")));
  if (matches.length === 0) {
    matches = open.filter((r) => candidates.has(r.code.slice(2)));
  }

  if (matches.length === 1) {
    const reg = matches[0];
    record.extracted_code = reg.code;
    record.linked_code = reg.code;
    const got = cents(parsed.amount);
    const due = cents(reg.amount_due);
    record.match_status = got >= due ? "MATCHED" : "AMOUNT_MISMATCH";
    if (got < due) {
      await notifyAdmins(
        s,
        `Amount mismatch on ${reg.code}`,
        `${reg.name} owes ${money(reg.amount_due)} but sent ${money(parsed.amount)} ` +
          `(confirmation ${parsed.confirmation}). No receipt sent. Resolve it on the Zelle tab of the admin.`
      );
    }
  } else if (matches.length > 1) {
    record.extracted_code = matches.map((m) => m.code).join(" ");
  } else {
    // Same amount and a shared name word: suggest only, never confirm.
    const senderTokens = parsed.sender_name.toUpperCase().split(/\s+/).filter(Boolean);
    const hits = open.filter((reg) => {
      if (cents(reg.amount_due) !== cents(parsed.amount)) return false;
      const nameTokens = reg.name.toUpperCase().split(/\s+/);
      return senderTokens.some((t) => nameTokens.includes(t));
    });
    if (hits.length === 1) record.suggested_code = hits[0].code;
  }

  return insertPayment(record);
}

async function insertPayment(record: Record<string, unknown>): Promise<PaymentRow> {
  const { data, error } = await getServiceClient()
    .from(PAYMENTS)
    .insert(record)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505" && record.match_status !== "DUPLICATE") {
      return insertPayment({ ...record, match_status: "DUPLICATE", linked_code: null });
    }
    throw new ApiError(500, `Could not save the payment: ${error.message}`);
  }
  return parsePayment(data);
}

/* ------------------------------------------------------------------ */
/* Apply                                                               */
/* ------------------------------------------------------------------ */

/**
 * Turns one MATCHED, unprocessed payment into a PAID registration with a
 * receipt and an audit row. Safe to call twice: the second call finds the
 * payment processed and does nothing.
 */
export async function applyPayment(
  pay: PaymentRow,
  actor: string,
  s: Settings
): Promise<RegistrationRow | null> {
  if (pay.match_status !== "MATCHED" || pay.processed_at || !pay.linked_code) {
    return null;
  }
  const db = getServiceClient();
  const now = new Date().toISOString();

  const { data: regRaw } = await db
    .from("registrations")
    .select("*")
    .eq("code", pay.linked_code)
    .maybeSingle();
  const reg = regRaw ? parseRegistration(regRaw) : null;
  if (!reg || (reg.status !== "PENDING" && reg.status !== "EXPIRED")) {
    await patchPayment(pay.id, { processed_at: now });
    return null;
  }

  const overpaid = cents(pay.amount) > cents(reg.amount_due);
  const { data, error } = await db
    .from("registrations")
    .update({
      status: "PAID",
      payment_method: "zelle",
      amount_received: pay.amount,
      paid_at: pay.received_at,
      zelle_confirmation_id: pay.confirmation_id,
      zelle_sender_name: pay.sender_name,
      notes: overpaid
        ? appendNote(reg.notes, `[OVERPAID by ${money(pay.amount - reg.amount_due)}]`)
        : reg.notes,
    })
    .eq("code", reg.code)
    .in("status", ["PENDING", "EXPIRED"])
    .select("*")
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  await patchPayment(pay.id, { processed_at: now });
  if (!data) return null;

  const { row } = await deliverReceipt(parseRegistration(data), s);
  await audit(
    actor,
    "AUTO_CONFIRMED",
    reg.code,
    { status: reg.status },
    { status: "PAID", amount_received: pay.amount, confirmation: pay.confirmation_id },
    overpaid ? "overpaid" : ""
  );
  if (overpaid) {
    await notifyAdmins(
      s,
      `Overpayment on ${reg.code}`,
      `${reg.name} owed ${money(reg.amount_due)} but sent ${money(pay.amount)}. Marked PAID; decide on the difference.`
    );
  }
  return row;
}

/** Applies every MATCHED payment that has not been processed yet. */
export async function applyMatchedPayments(
  actor: string,
  s: Settings
): Promise<string[]> {
  const { data, error } = await getServiceClient()
    .from(PAYMENTS)
    .select("*")
    .eq("match_status", "MATCHED")
    .is("processed_at", null)
    .order("received_at", { ascending: true });
  if (error) throw new ApiError(500, error.message);
  const applied: string[] = [];
  for (const raw of data ?? []) {
    const row = await applyPayment(parsePayment(raw), actor, s);
    if (row) applied.push(row.code);
  }
  return applied;
}

/* ------------------------------------------------------------------ */
/* Inbound emails from the Gmail relay                                 */
/* ------------------------------------------------------------------ */

export type InboundMessage = {
  message_id: string;
  received_at: string;
  subject: string;
  body: string;
};

export type IngestOutcome = {
  message_id: string;
  status: "recorded" | "already_seen" | "not_zelle" | "duplicate_payment";
  match_status?: MatchStatus;
  linked_code?: string | null;
  suggested_code?: string | null;
};

export async function ingestEmails(messages: InboundMessage[]): Promise<{
  results: IngestOutcome[];
  applied: string[];
  auto_confirm: boolean;
}> {
  const s = await getSettings();
  const db = getServiceClient();
  const results: IngestOutcome[] = [];

  for (const m of messages) {
    const receivedAt = Number.isNaN(Date.parse(m.received_at))
      ? new Date().toISOString()
      : new Date(m.received_at).toISOString();
    const ins = await db.from(RAW).insert({
      message_id: m.message_id,
      received_at: receivedAt,
      subject: m.subject.slice(0, 500),
      body_plain: m.body.slice(0, MAX_BODY),
      parsed: false,
    });
    if (ins.error) {
      if (ins.error.code === "23505") {
        results.push({ message_id: m.message_id, status: "already_seen" });
        continue;
      }
      throw new ApiError(500, `Could not store the email: ${ins.error.message}`);
    }

    const parsed = parseZelleEmail(m.body, m.subject, m.message_id);
    if (!parsed) {
      results.push({ message_id: m.message_id, status: "not_zelle" });
      continue;
    }
    const pay = await recordPayment(parsed, receivedAt, "email", m.message_id, s);
    await db.from(RAW).update({ parsed: true }).eq("message_id", m.message_id);
    results.push({
      message_id: m.message_id,
      status: pay.match_status === "DUPLICATE" ? "duplicate_payment" : "recorded",
      match_status: pay.match_status,
      linked_code: pay.linked_code,
      suggested_code: pay.suggested_code,
    });
  }

  const applied = s.auto_confirm ? await applyMatchedPayments("system", s) : [];
  return { results, applied, auto_confirm: s.auto_confirm };
}

/* ------------------------------------------------------------------ */
/* Admin actions                                                       */
/* ------------------------------------------------------------------ */

export type PaymentActionResult = {
  payment: PaymentRow;
  registration: RegistrationRow | null;
  message: string;
};

/** Typed in by the treasurer from the bank app. Confirms right away if it matches. */
export async function recordManualPayment(
  data: Record<string, unknown>,
  actor: string
): Promise<PaymentActionResult> {
  const confirmation = String(data.confirmation_id ?? "").trim();
  if (!confirmation) throw new ApiError(400, "The Zelle confirmation number is required.");
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "Enter the amount received.");
  const receivedRaw = String(data.received_at ?? "").trim();
  const receivedAt =
    receivedRaw && !Number.isNaN(Date.parse(receivedRaw))
      ? new Date(receivedRaw).toISOString()
      : new Date().toISOString();

  const s = await getSettings();
  const payment = await recordPayment(
    {
      amount,
      sender_name: String(data.sender_name ?? "").trim(),
      confirmation,
      memo_raw: String(data.memo_raw ?? "").trim(),
    },
    receivedAt,
    "admin",
    null,
    s
  );

  if (payment.match_status === "DUPLICATE") {
    return {
      payment,
      registration: null,
      message: `Confirmation ${confirmation} was already recorded. Saved as a duplicate.`,
    };
  }
  if (payment.match_status === "MATCHED") {
    const registration = await applyPayment(payment, actor, s);
    const fresh = await getPayment(payment.id);
    return {
      payment: fresh,
      registration,
      message: registration
        ? `Matched ${registration.code} and marked it PAID.`
        : `Matched ${payment.linked_code} but it was already handled.`,
    };
  }
  if (payment.match_status === "AMOUNT_MISMATCH") {
    return {
      payment,
      registration: null,
      message: `Matched ${payment.linked_code} but the amount is short. Resolve it on the Zelle tab.`,
    };
  }
  return {
    payment,
    registration: null,
    message: payment.suggested_code
      ? `No code in the memo. Looks like ${payment.suggested_code}; link it if that is right.`
      : "No code in the memo. Find the person in All registrations and link the payment.",
  };
}

/** The treasurer says which code an unmatched payment belongs to. */
export async function linkPayment(
  id: number,
  code: string,
  actor: string
): Promise<PaymentActionResult> {
  const s = await getSettings();
  const pay = await getPayment(id);
  if (pay.processed_at) throw new ApiError(409, "This payment is already applied.");
  const reg = await getRegistration(code);
  if (reg.status !== "PENDING" && reg.status !== "EXPIRED") {
    throw new ApiError(409, `${code} is ${reg.status}, so this payment cannot be applied to it.`);
  }
  const linked = await patchPayment(id, {
    match_status: "MATCHED",
    linked_code: reg.code,
    extracted_code: reg.code,
    processed_at: null,
  });
  await audit(
    actor,
    "LINK_PAYMENT",
    reg.code,
    { match_status: pay.match_status },
    { match_status: "MATCHED", confirmation: pay.confirmation_id },
    ""
  );
  const registration = await applyPayment(linked, actor, s);
  return {
    payment: await getPayment(id),
    registration,
    message: registration
      ? `Linked ${pay.confirmation_id} to ${reg.code} and marked it PAID.`
      : `Linked ${pay.confirmation_id} to ${reg.code}.`,
  };
}

/** Underpayment: accept what arrived, or just note it and chase the rest. */
export async function resolveMismatch(
  id: number,
  decision: "accept" | "note",
  note: unknown,
  actor: string
): Promise<PaymentActionResult> {
  const s = await getSettings();
  const pay = await getPayment(id);
  if (pay.match_status !== "AMOUNT_MISMATCH" || !pay.linked_code) {
    throw new ApiError(409, "This payment is not an amount mismatch.");
  }
  const why = String(note ?? "").trim().slice(0, 500);
  const reg = await getRegistration(pay.linked_code);

  if (decision === "note") {
    await audit(actor, "MISMATCH_NOTED", reg.code, null, null, why);
    return {
      payment: pay,
      registration: reg,
      message: "Noted. Ask the member for the difference, then Mark paid on the registration.",
    };
  }

  if (reg.status !== "PENDING" && reg.status !== "EXPIRED") {
    throw new ApiError(409, `${reg.code} is ${reg.status}.`);
  }
  const { data, error } = await getServiceClient()
    .from("registrations")
    .update({
      status: "PAID",
      payment_method: "zelle",
      amount_received: pay.amount,
      paid_at: pay.received_at,
      zelle_confirmation_id: pay.confirmation_id,
      zelle_sender_name: pay.sender_name,
      notes: appendNote(reg.notes, `[mismatch accepted]${why ? ` ${why}` : ""}`),
    })
    .eq("code", reg.code)
    .in("status", ["PENDING", "EXPIRED"])
    .select("*")
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(409, `${reg.code} was just updated by someone else.`);
  await patchPayment(id, { processed_at: new Date().toISOString() });
  const { row } = await deliverReceipt(parseRegistration(data), s);
  await audit(actor, "MISMATCH_ACCEPTED", reg.code, { amount_due: reg.amount_due }, { amount: pay.amount }, why);
  return {
    payment: await getPayment(id),
    registration: row,
    message: `Accepted ${money(pay.amount)} for ${reg.code} and marked it PAID.`,
  };
}
