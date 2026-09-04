import "server-only";
import { ApiError, getServiceClient } from "@/lib/supabase-server";
import { sendEmail, type EmailResult } from "@/lib/email";
import { audit } from "./audit";
import { randomCode } from "./codes";
import { pendingEmail, receiptEmail } from "./emails";
import {
  breakdownLines,
  codePrefix,
  computeAmount,
  money,
  roundCents,
  type LineItems,
} from "./pricing";
import { getSettings, type Settings } from "./settings";
import {
  isMethod,
  parseRegistration,
  type PaymentMethod,
  type RegistrationRow,
} from "./types";

/**
 * Everything that changes a registration lives here, so the API routes stay
 * thin and every path writes the audit log the same way.
 */

const TABLE = "registrations";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_DONATION = 100_000;

export type CleanInput = LineItems & {
  name: string;
  phone: string;
  email: string;
  comment: string;
  announcements_opt_in: boolean;
};

function clampInt(v: unknown, min: number, max: number): number {
  let n = Math.floor(Number(v ?? 0));
  if (Number.isNaN(n)) n = 0;
  return Math.max(min, Math.min(max, n));
}

function nowIso(): string {
  return new Date().toISOString();
}

export function appendNote(existing: string, extra: string): string {
  if (!extra) return existing;
  return existing ? `${existing} ${extra}` : extra;
}

/**
 * Cleans and checks what a form sent. "web" requires phone and email like the
 * public form always did; "admin" only needs a name (walk-ins, phone calls).
 */
export function validateRegistrationInput(
  data: Record<string, unknown>,
  mode: "web" | "admin"
): CleanInput {
  const donationRaw = Number(data.donation ?? 0);
  const donation = Number.isFinite(donationRaw)
    ? Math.min(MAX_DONATION, Math.max(0, roundCents(donationRaw)))
    : 0;
  const reg: CleanInput = {
    name: String(data.name ?? "").trim().slice(0, 120),
    phone: String(data.phone ?? "").replace(/\D/g, "").slice(0, 20),
    email: String(data.email ?? "").trim().toLowerCase().slice(0, 200),
    adults: clampInt(data.adults, 0, 50),
    children: clampInt(data.children, 0, 50),
    ticket_type: data.ticket_type === "student" ? "student" : "professional",
    coupons_qty: clampInt(data.coupons_qty, 0, 500),
    donation,
    comment: String(data.comment ?? "").trim().slice(0, 1000),
    announcements_opt_in: Boolean(data.announcements),
  };
  if (!reg.name) throw new ApiError(400, "Name is required.");
  if (mode === "web") {
    if (!reg.phone) throw new ApiError(400, "Phone is required.");
    if (!EMAIL_RE.test(reg.email)) {
      throw new ApiError(400, "A valid email is required.");
    }
  } else if (reg.email && !EMAIL_RE.test(reg.email)) {
    throw new ApiError(400, "That email address does not look right.");
  }
  if (reg.adults + reg.children + reg.coupons_qty === 0 && reg.donation === 0) {
    throw new ApiError(400, "Nothing selected.");
  }
  return reg;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function getRegistration(code: string): Promise<RegistrationRow> {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, `Code not found: ${code}`);
  return parseRegistration(data);
}

async function patchRow(
  code: string,
  patch: Record<string, unknown>
): Promise<RegistrationRow> {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update(patch)
    .eq("code", code)
    .select("*")
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, `Code not found: ${code}`);
  return parseRegistration(data);
}

/**
 * The same person submitting twice within a day for the same amount gets the
 * same code back instead of a second one, which keeps the treasurer's list
 * clean and the member's inbox calm.
 */
export async function findRecentPending(
  email: string,
  amountDue: number
): Promise<RegistrationRow | null> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select("*")
    .eq("email", email)
    .eq("status", "PENDING")
    .eq("amount_due", amountDue)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return parseRegistration(data);
}

/** Cheap per-email and per-IP throttle built on the table itself. */
export async function checkThrottle(
  email: string,
  ip: string | null
): Promise<void> {
  const db = getServiceClient();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const byEmail = await db
    .from(TABLE)
    .select("code", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", since);
  const byIp = ip
    ? await db
        .from(TABLE)
        .select("code", { count: "exact", head: true })
        .eq("client_ip", ip)
        .gte("created_at", since)
    : { count: 0 };
  if ((byEmail.count ?? 0) >= 3 || (byIp.count ?? 0) >= 6) {
    throw new ApiError(
      429,
      "Too many attempts. Please wait a few minutes and try again."
    );
  }
}

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */

function errorText(res: EmailResult): string {
  if (res.sent) return "";
  if (res.reason === "provider_error") return (res.detail || "provider_error").slice(0, 300);
  return res.reason;
}

async function deliverPendingEmail(
  row: RegistrationRow,
  s: Settings
): Promise<EmailResult> {
  if (!row.email) {
    await patchRow(row.code, { email_error: "no_email" });
    return { sent: false, reason: "invalid_recipient", detail: "no email" };
  }
  const content = pendingEmail(row, s);
  const res = await sendEmail({
    to: row.email,
    ...content,
    replyTo: s.contact_email || undefined,
  });
  await patchRow(
    row.code,
    res.sent
      ? { pending_email_sent_at: nowIso(), email_error: null }
      : { email_error: errorText(res) }
  );
  return res;
}

export async function deliverReceipt(
  row: RegistrationRow,
  s: Settings
): Promise<{ row: RegistrationRow; email: EmailResult }> {
  if (!row.email) {
    const updated = await patchRow(row.code, { email_error: "no_email" });
    return {
      row: updated,
      email: { sent: false, reason: "invalid_recipient", detail: "no email" },
    };
  }
  const content = receiptEmail(row, s);
  const res = await sendEmail({
    to: row.email,
    ...content,
    replyTo: s.contact_email || undefined,
  });
  const updated = await patchRow(
    row.code,
    res.sent
      ? { receipt_sent_at: nowIso(), email_error: null }
      : { email_error: errorText(res) }
  );
  return { row: updated, email: res };
}

/** Short human tail for admin messages. */
export function emailOutcome(res: EmailResult | null, what: string): string {
  if (!res) return "";
  if (res.sent) return `, ${what} sent.`;
  if (res.reason === "invalid_recipient") return `, no email on file.`;
  if (res.reason === "no_provider") return `, email is not set up so no ${what} went out.`;
  return `, but the ${what} email failed.`;
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export type CreateResult = {
  code: string;
  amount: string;
  amount_due: number;
  zelle_recipient: string;
  zelle_recipient_name: string;
  breakdown: string[];
  email_sent: boolean;
  contact_email: string;
  status: RegistrationRow["status"];
};

export function toCreateResult(
  row: RegistrationRow,
  s: Settings
): CreateResult {
  return {
    code: row.code,
    amount: money(row.amount_due),
    amount_due: row.amount_due,
    zelle_recipient: s.zelle_recipient,
    zelle_recipient_name: s.zelle_recipient_name,
    breakdown: breakdownLines(row, s),
    email_sent: Boolean(row.pending_email_sent_at),
    contact_email: s.contact_email,
    status: row.status,
  };
}

/**
 * Inserts a PENDING row with a fresh code, writes the audit row, and sends
 * the pending email. The amount is always computed here, never trusted from
 * the browser.
 */
export async function createRegistration(
  input: CleanInput,
  opts: { createdBy: string; clientIp?: string | null; notify?: boolean },
  settings?: Settings
): Promise<{ row: RegistrationRow; email: EmailResult | null; settings: Settings }> {
  const s = settings ?? (await getSettings());
  const amount = computeAmount(input, s);
  if (amount <= 0) throw new ApiError(400, "Amount is zero.");
  const prefix = codePrefix(input);
  const db = getServiceClient();

  let row: RegistrationRow | null = null;
  for (let attempt = 0; attempt < 20 && !row; attempt++) {
    const code = randomCode(prefix);
    const { data, error } = await db
      .from(TABLE)
      .insert({
        code,
        name: input.name,
        phone: input.phone,
        email: input.email,
        adults: input.adults,
        children: input.children,
        ticket_type: input.ticket_type,
        coupons_qty: input.coupons_qty,
        donation: input.donation,
        comment: input.comment,
        amount_due: amount,
        status: "PENDING",
        created_by: opts.createdBy,
        announcements_opt_in: input.announcements_opt_in,
        client_ip: opts.clientIp ?? null,
      })
      .select("*")
      .single();
    if (!error && data) {
      row = parseRegistration(data);
    } else if (error && error.code !== "23505") {
      throw new ApiError(500, `Could not save the registration: ${error.message}`);
    }
  }
  if (!row) {
    throw new ApiError(500, "Could not generate a unique code. Please try again.");
  }

  if (opts.createdBy === "web") {
    await audit("system", "REGISTRATION_CREATED", row.code, null, {
      amount_due: amount,
      email: row.email,
    });
  } else {
    await audit(
      opts.createdBy,
      "ADMIN_CREATED",
      row.code,
      null,
      { amount_due: amount },
      "walk-in/phone entry"
    );
  }

  let email: EmailResult | null = null;
  if (opts.notify !== false) {
    email = await deliverPendingEmail(row, s);
    row = await getRegistration(row.code);
  }
  return { row, email, settings: s };
}

/* ------------------------------------------------------------------ */
/* Admin actions                                                       */
/* ------------------------------------------------------------------ */

export type ActionResult = {
  row: RegistrationRow;
  message: string;
  email?: EmailResult;
};

export async function markPaid(
  code: string,
  opts: { method?: unknown; amount?: unknown; note?: unknown },
  actor: string
): Promise<ActionResult> {
  const s = await getSettings();
  const existing = await getRegistration(code);
  if (existing.status === "PAID") {
    throw new ApiError(409, `${code} is already PAID. Use Resend receipt.`);
  }
  if (existing.status === "CANCELLED" || existing.status === "REFUNDED") {
    throw new ApiError(
      409,
      `${code} is ${existing.status}. Create a new entry instead.`
    );
  }
  const method: PaymentMethod = isMethod(opts.method) ? opts.method : "cash";
  const requested = Number(opts.amount);
  const amt =
    Number.isFinite(requested) && requested > 0
      ? roundCents(requested)
      : existing.amount_due;
  const note = String(opts.note ?? "").trim().slice(0, 500);

  // The status filter makes a double click or two admins at once harmless:
  // only one of them updates anything.
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update({
      status: "PAID",
      payment_method: method,
      amount_received: amt,
      paid_at: nowIso(),
      notes: appendNote(existing.notes, note),
    })
    .eq("code", code)
    .in("status", ["PENDING", "EXPIRED"])
    .select("*")
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) {
    throw new ApiError(409, `${code} was just updated by someone else. Refresh and check.`);
  }

  const paid = parseRegistration(data);
  const { row, email } = await deliverReceipt(paid, s);
  await audit(
    actor,
    "MARK_PAID",
    code,
    { status: existing.status },
    { status: "PAID", method, amount: amt },
    note
  );
  return {
    row,
    email,
    message: `Marked ${code} paid (${money(amt)} ${method})${emailOutcome(email, "receipt")}`,
  };
}

export async function adjustAmount(
  code: string,
  newAmount: unknown,
  note: unknown,
  actor: string
): Promise<ActionResult> {
  const amt = Number(newAmount);
  if (!Number.isFinite(amt) || amt < 0) {
    throw new ApiError(400, "Enter a valid amount.");
  }
  const existing = await getRegistration(code);
  const rounded = roundCents(amt);
  const row = await patchRow(code, { amount_due: rounded });
  await audit(
    actor,
    "ADJUST_AMOUNT",
    code,
    { amount_due: existing.amount_due },
    { amount_due: rounded },
    String(note ?? "").trim().slice(0, 500)
  );
  return { row, message: `Amount for ${code} set to ${money(rounded)}.` };
}

export async function voidRegistration(
  code: string,
  reason: unknown,
  actor: string
): Promise<ActionResult> {
  const why = String(reason ?? "").trim().slice(0, 500);
  if (!why) throw new ApiError(400, "A reason is required.");
  const existing = await getRegistration(code);
  if (existing.status === "CANCELLED" || existing.status === "REFUNDED") {
    throw new ApiError(409, `${code} is already ${existing.status}.`);
  }
  const newStatus = existing.status === "PAID" ? "REFUNDED" : "CANCELLED";
  const row = await patchRow(code, {
    status: newStatus,
    notes: appendNote(existing.notes, `[${newStatus}: ${why}]`),
  });
  await audit(
    actor,
    newStatus,
    code,
    { status: existing.status },
    { status: newStatus },
    why
  );
  return { row, message: `${code} is now ${newStatus}.` };
}

export async function resendReceipt(
  code: string,
  actor: string
): Promise<ActionResult> {
  const s = await getSettings();
  const existing = await getRegistration(code);
  if (existing.status !== "PAID") {
    throw new ApiError(409, `${code} is not PAID.`);
  }
  if (!existing.email) throw new ApiError(400, "No email address on file.");
  const { row, email } = await deliverReceipt(existing, s);
  await audit(actor, "RESEND_RECEIPT", code, null, null, "");
  if (!email.sent) {
    const why =
      email.reason === "no_provider"
        ? "Email is not set up on the server."
        : `The email provider refused it: ${email.detail || email.reason}`;
    throw new ApiError(502, `Receipt for ${code} was not sent. ${why}`);
  }
  return { row, email, message: `Receipt re-sent for ${code}.` };
}

export async function mergeInto(
  keepCode: string,
  dropCode: string,
  actor: string
): Promise<ActionResult> {
  if (keepCode === dropCode) {
    throw new ApiError(400, "Pick two different codes.");
  }
  const keep = await getRegistration(keepCode);
  const drop = await getRegistration(dropCode);
  if (drop.status === "PAID") {
    throw new ApiError(
      409,
      `${dropCode} is PAID. Void it with a reason instead of merging it away.`
    );
  }
  const row = await patchRow(dropCode, {
    status: "CANCELLED",
    notes: appendNote(drop.notes, `[merged into ${keep.code}]`),
  });
  await audit(
    actor,
    "MERGE",
    keep.code,
    { dropped: dropCode },
    null,
    "duplicate merged"
  );
  return { row, message: `${dropCode} merged into ${keep.code}.` };
}

/** Walk-in or phone registration entered by an admin. */
export async function createAdminEntry(
  data: Record<string, unknown>,
  opts: { markPaidNow: boolean; method?: unknown },
  actor: string
): Promise<ActionResult> {
  const input = validateRegistrationInput(data, "admin");
  input.comment = input.comment || "created by admin";
  input.announcements_opt_in = false;
  const created = await createRegistration(
    input,
    { createdBy: actor, notify: !opts.markPaidNow },
    undefined
  );
  if (opts.markPaidNow) {
    const paid = await markPaid(
      created.row.code,
      { method: opts.method, note: "paid at creation" },
      actor
    );
    return paid;
  }
  return {
    row: created.row,
    email: created.email ?? undefined,
    message: `Created ${created.row.code} for ${money(created.row.amount_due)} (PENDING)${emailOutcome(
      created.email,
      "code email"
    )}`,
  };
}

/** PENDING rows older than the cutoff become EXPIRED. Returns their codes. */
export async function expirePending(
  hours: number,
  actor = "system"
): Promise<string[]> {
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 72;
  const cutoff = new Date(Date.now() - safeHours * 3600 * 1000).toISOString();
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update({ status: "EXPIRED" })
    .eq("status", "PENDING")
    .lt("created_at", cutoff)
    .select("code");
  if (error) throw new ApiError(500, error.message);
  const codes = (data ?? []).map((r) => String(r.code));
  for (const code of codes) {
    await audit(
      actor,
      "AUTO_EXPIRED",
      code,
      { status: "PENDING" },
      { status: "EXPIRED" },
      `${safeHours}h unpaid`
    );
  }
  return codes;
}
