import "server-only";
import { ApiError, getServiceClient } from "@/lib/supabase-server";
import { sendEmail, type EmailResult } from "@/lib/email";
import { sendSms, smsConfigured, type SmsResult } from "@/lib/sms";
import { audit } from "./audit";
import { randomCode } from "./codes";
import { pendingEmail, receiptEmail } from "./emails";
import { pendingSms, receiptSms } from "./sms-messages";
import {
  breakdownLines,
  codePrefix,
  computeAmount,
  DONATION_MIN,
  headcount,
  money,
  outstanding,
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
    youth: clampInt(data.youth, 0, 50),
    children: clampInt(data.children, 0, 50),
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
  if (headcount(reg) + reg.coupons_qty === 0 && reg.donation === 0) {
    throw new ApiError(400, "Nothing selected.");
  }
  // A donation is all or nothing on the public form: give at least the
  // minimum or give nothing. No code is created for anything in between.
  // The admin is exempt, the same way it is exempt from the phone and email
  // rules, so a smaller amount handed over in cash can still be recorded.
  if (mode === "web" && reg.donation > 0 && reg.donation < DONATION_MIN) {
    throw new ApiError(
      400,
      `A donation has to be at least ${money(DONATION_MIN)}. Please raise the amount, or turn the donation off.`
    );
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
    kind: "pending",
    code: row.code,
  });
  await patchRow(
    row.code,
    res.sent
      ? { pending_email_sent_at: nowIso(), email_error: null }
      : { email_error: errorText(res) }
  );
  return res;
}

/**
 * Called by the outbox when the Gmail relay has sent an email. The "queued"
 * mark is cleared only when nothing else is waiting for the same code.
 */
export async function noteEmailDelivered(
  code: string,
  kind: "pending" | "receipt",
  sentAt: string,
  clearQueuedMark: boolean
): Promise<void> {
  const patch: Record<string, unknown> =
    kind === "pending" ? { pending_email_sent_at: sentAt } : { receipt_sent_at: sentAt };
  if (clearQueuedMark) patch.email_error = null;
  try {
    await patchRow(code, patch);
  } catch (err) {
    console.error(`noteEmailDelivered ${code}:`, err instanceof Error ? err.message : err);
  }
}

/** Called by the outbox when the relay gave up on an email. */
export async function noteEmailFailed(code: string, detail: string): Promise<void> {
  try {
    await patchRow(code, { email_error: detail.slice(0, 300) });
  } catch (err) {
    console.error(`noteEmailFailed ${code}:`, err instanceof Error ? err.message : err);
  }
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
    kind: "receipt",
    code: row.code,
  });
  const updated = await patchRow(
    row.code,
    res.sent
      ? { receipt_sent_at: nowIso(), email_error: null }
      : { email_error: errorText(res) }
  );
  await deliverSms(updated, s, "receipt");
  return { row: updated, email: res };
}

/* ------------------------------------------------------------------ */
/* Texts                                                               */
/* ------------------------------------------------------------------ */

/**
 * Sends one text and records what happened, without ever being able to break
 * a registration. Three separate guards have to pass first: the admin switch
 * in Settings, the Twilio values on the server, and a usable phone number.
 * The recording step swallows its own errors too, so a site whose database
 * has not had supabase/sms.sql run still sends texts, it just cannot show
 * them on the admin screen.
 */
export async function deliverSms(
  row: RegistrationRow,
  s: Settings,
  kind: "pending" | "receipt"
): Promise<SmsResult | null> {
  if (!s.sms_enabled || !smsConfigured() || !row.phone) return null;

  let res: SmsResult;
  try {
    const body = kind === "pending" ? pendingSms(row, s) : receiptSms(row, s);
    res = await sendSms(row.phone, body);
  } catch (err) {
    // sendSms is written not to throw, so this only catches a bug in the
    // message builders. A member must never see a registration fail for it.
    console.error(`deliverSms ${row.code}:`, err instanceof Error ? err.message : err);
    return null;
  }

  const field = kind === "pending" ? "code_sms_at" : "ticket_sms_at";
  const patch: Record<string, unknown> = res.sent
    ? { [field]: nowIso(), sms_error: null }
    : { sms_error: `${res.reason}${res.detail ? `: ${res.detail}` : ""}`.slice(0, 300) };
  try {
    await patchRow(row.code, patch);
  } catch (err) {
    console.error(`deliverSms record ${row.code}:`, err instanceof Error ? err.message : err);
  }
  return res;
}

/** Short human tail for admin messages. */
export function emailOutcome(res: EmailResult | null, what: string): string {
  if (!res) return "";
  if (res.sent) return `, ${what} sent.`;
  if (res.reason === "queued") return `, ${what} goes out within a few minutes.`;
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
  /** True while the Gmail relay still has the code email to send. */
  email_queued: boolean;
  contact_email: string;
  status: RegistrationRow["status"];
};

export function toCreateResult(
  row: RegistrationRow,
  s: Settings
): CreateResult {
  // What to send is the balance, not the whole bill: a top-up on a code that
  // was already paid once owes only the difference.
  const owed = outstanding(row);
  return {
    code: row.code,
    amount: money(owed),
    amount_due: owed,
    zelle_recipient: s.zelle_recipient,
    zelle_recipient_name: s.zelle_recipient_name,
    breakdown: breakdownLines(row, s),
    email_sent: Boolean(row.pending_email_sent_at),
    email_queued: !row.pending_email_sent_at && row.email_error === "queued",
    contact_email: s.contact_email,
    status: row.status,
  };
}

/** Names match when they are the same words, whatever the spacing or case. */
function sameName(a: string, b: string): boolean {
  const tidy = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return tidy(a) !== "" && tidy(a) === tidy(b);
}

/**
 * The registration a new order should be added to, or null to start a fresh
 * one.
 *
 * Someone who registered before and comes back for coupons or to leave a
 * donation keeps the code they already have, so they keep one code, one
 * link and one QR for everything they ever buy. Matching needs the phone
 * and the name to agree: a household shares a phone, and a husband
 * registering his wife must never be folded into his own row.
 *
 * Cancelled, refunded and expired rows are left alone, and so is anything
 * where a payment has been recorded but not yet applied, because raising the
 * bill underneath a payment already on its way would turn a good transfer
 * into a shortfall.
 */
export async function findTopUpTarget(
  input: CleanInput
): Promise<RegistrationRow | null> {
  if (!input.phone) return null;
  const db = getServiceClient();
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("phone", input.phone)
    .in("status", ["PENDING", "PAID"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data?.length) return null;

  const mine = data
    .map((r) => parseRegistration(r))
    .filter((r) => sameName(r.name, input.name));
  if (!mine.length) return null;

  // A settled row first: adding to it is unambiguous. Otherwise the most
  // recent one they hold, even if it still owes money, because the whole
  // point is that a person carries one code and the bill simply grows.
  const settled = mine.find((r) => r.status === "PAID" && outstanding(r) === 0);
  const candidate = settled ?? mine[0];
  if (!candidate) return null;

  // Unless a payment is sitting against it that has not been applied yet.
  // Raising the bill underneath money already in flight would turn a good
  // transfer into a shortfall, so that person starts a fresh code instead.
  const { count } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("linked_code", candidate.code)
    .is("processed_at", null);
  return (count ?? 0) > 0 ? null : candidate;
}

/**
 * Adds an order to a registration that already exists, keeping its code.
 *
 * Only what was bought and what is owed change. The code, and therefore the
 * ticket link and the QR already in somebody's phone, stay exactly as they
 * were. A settled row stays PAID so its ticket keeps working at the door
 * while the new balance is outstanding; the coupons on it are what the desk
 * withholds until that balance is cleared.
 */
export async function addToRegistration(
  target: RegistrationRow,
  input: CleanInput,
  s: Settings,
  actor: string
): Promise<{ row: RegistrationRow; email: EmailResult | null }> {
  const added = computeAmount(input, s);
  if (added <= 0) {
    throw new ApiError(400, "The total is zero, so there is nothing to add.");
  }
  const merged = {
    adults: target.adults + input.adults,
    youth: target.youth + input.youth,
    children: target.children + input.children,
    coupons_qty: target.coupons_qty + input.coupons_qty,
    donation: roundCents(target.donation + input.donation),
  };
  const due = roundCents(target.amount_due + added);

  // Adding to a settled code puts it back in debt, so the label has to go
  // back too. Leaving it on PAID was how a row could sit in the admin list
  // marked paid while owing a hundred and fifty dollars. The door and the
  // matcher both read the balance rather than the label, so nothing was let
  // through, but the desk was being told the opposite of the truth.
  //
  // Only PAID and EXPIRED move. A cancelled or refunded row keeps its status,
  // which is the record of what happened to it.
  const reopen =
    Math.round(due * 100) > Math.round((target.amount_received ?? 0) * 100) &&
    (target.status === "PAID" || target.status === "EXPIRED");

  const row = await patchRow(target.code, {
    ...merged,
    amount_due: due,
    ...(reopen ? { status: "PENDING" as const } : {}),
    comment: input.comment
      ? appendNote(target.comment, input.comment)
      : target.comment,
  });

  await audit(
    actor,
    "TOPPED_UP",
    target.code,
    { amount_due: target.amount_due, coupons_qty: target.coupons_qty, donation: target.donation, status: target.status },
    { amount_due: row.amount_due, coupons_qty: row.coupons_qty, donation: row.donation, status: row.status },
    `added ${money(added)}, balance now ${money(outstanding(row))}`
  );

  // Same two messages a new registration gets, carrying the balance to send
  // rather than the whole bill, because toCreateResult and the templates
  // both read what is outstanding.
  const email = await deliverPendingEmail(row, s);
  await deliverSms(row, s, "pending");
  return { row: await getRegistration(target.code), email };
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
  if (amount <= 0) {
    throw new ApiError(
      400,
      "The total is zero. Children under 10 are free, so add at least one adult, a raffle draw coupon, or a donation."
    );
  }
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
        youth: input.youth,
        children: input.children,
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
    await deliverSms(row, s, "pending");
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
  const owed = outstanding(existing);
  // Already PAID is only a mistake when nothing is owed. A code that was
  // paid and has since had coupons or a donation added owes the difference,
  // and taking that at the desk is exactly this action.
  if (existing.status === "PAID" && owed === 0) {
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
    Number.isFinite(requested) && requested > 0 ? roundCents(requested) : owed;
  const note = String(opts.note ?? "").trim().slice(0, 500);

  // Filtering on the amount already received makes a double click, or two
  // admins at once, harmless: only the first of them updates anything.
  //
  // A row nobody has paid yet holds null here rather than zero, and null has
  // to be matched with is(), not eq(): eq sends the word "null", which the
  // database then tries to read as a number and refuses.
  // PAID means the bill is covered, nothing less. Taking part of what is
  // owed credits the money and leaves the registration owing the rest,
  // rather than calling it settled and letting the desk hand everything over.
  const received = roundCents((existing.amount_received ?? 0) + amt);
  const covered = Math.round(received * 100) >= Math.round(existing.amount_due * 100);
  const query = getServiceClient()
    .from(TABLE)
    .update({
      status: covered ? "PAID" : "PENDING",
      payment_method: method,
      amount_received: received,
      paid_at: covered ? nowIso() : existing.paid_at,
      notes: appendNote(existing.notes, note),
    })
    .eq("code", code);
  const { data, error } = await (existing.amount_received === null
    ? query.is("amount_received", null)
    : query.eq("amount_received", existing.amount_received)
  )
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
  if (!email.sent && email.reason === "queued") {
    return {
      row,
      email,
      message: `Receipt for ${code} is queued; the Gmail relay sends it within a few minutes.`,
    };
  }
  if (!email.sent) {
    const why =
      email.reason === "no_provider"
        ? "Email is not set up on the server."
        : `The email provider refused it: ${email.detail || email.reason}`;
    throw new ApiError(502, `Receipt for ${code} was not sent. ${why}`);
  }
  return { row, email, message: `Receipt re-sent for ${code}.` };
}

/**
 * Hands a registration to a different person: someone paid, cannot come, and
 * a friend goes in their place. Only who changes; what was bought and what
 * was paid never do, so the money trail stays exactly as it was matched.
 *
 * Refused when the row carries a donation. Everything on a row moves with it,
 * and a donation is credited to the person who gave it; moving that under a
 * new name would misstate who supported the association.
 */
export async function reassignRegistration(
  code: string,
  to: { name?: unknown; phone?: unknown; email?: unknown },
  actor: string
): Promise<ActionResult> {
  const s = await getSettings();
  const existing = await getRegistration(code);
  if (existing.status !== "PAID" && existing.status !== "PENDING") {
    throw new ApiError(409, `${code} is ${existing.status}, so it cannot be reassigned.`);
  }
  if (existing.donation > 0) {
    throw new ApiError(
      409,
      `${code} carries a ${money(existing.donation)} donation, which belongs to ${existing.name}. Tickets can be reassigned; donations stay with the giver.`
    );
  }
  const name = String(to.name ?? "").trim().slice(0, 120);
  const phone = String(to.phone ?? "").replace(/\D/g, "").slice(0, 20);
  const email = String(to.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!name) throw new ApiError(400, "The new holder needs a name.");
  if (email && !EMAIL_RE.test(email)) {
    throw new ApiError(400, "That email address does not look right.");
  }

  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update({ name, phone, email })
    .eq("code", code)
    .select("*")
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, `Code not found: ${code}`);
  let row = parseRegistration(data);

  await audit(
    actor,
    "REASSIGNED",
    code,
    { name: existing.name, phone: existing.phone, email: existing.email },
    { name, phone, email },
    `paid by ${existing.name}`
  );

  // The new holder needs the ticket in their own hands.
  let sent = "";
  if (row.status === "PAID" && row.email) {
    const delivered = await deliverReceipt(row, s);
    row = delivered.row;
    sent = delivered.email.sent || delivered.email.reason === "queued"
      ? ` Ticket sent to ${email}.`
      : " The ticket could not be emailed; resend it once email is set up.";
  }
  return { row, message: `${code} now belongs to ${name}.${sent}` };
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

/**
 * PENDING rows older than the cutoff become EXPIRED. Returns their codes.
 *
 * Two things are deliberately spared, because the row's age is not the same
 * as the debt's age and this sweep only has the former to go on:
 *
 *  - anything with money on it. Part payment is not nothing, and a code that
 *    was settled and then added to reads as PENDING again.
 *  - anything topped up since the cutoff. The row may be a week old while the
 *    balance was only put there this morning.
 *
 * Without these, someone who registered last week, paid, and bought coupons
 * today would be expired minutes after buying them.
 */
export async function expirePending(
  hours: number,
  actor = "system"
): Promise<string[]> {
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 72;
  const cutoff = new Date(Date.now() - safeHours * 3600 * 1000).toISOString();
  const db = getServiceClient();

  const { data: candidates, error: findErr } = await db
    .from(TABLE)
    .select("code")
    .eq("status", "PENDING")
    .lt("created_at", cutoff)
    .or("amount_received.is.null,amount_received.eq.0");
  if (findErr) throw new ApiError(500, findErr.message);
  let wanted = (candidates ?? []).map((r) => String(r.code));
  if (wanted.length === 0) return [];

  const { data: toppedUp } = await db
    .from("audit_log")
    .select("entity_code")
    .eq("action", "TOPPED_UP")
    .gte("at", cutoff)
    .in("entity_code", wanted);
  const recent = new Set((toppedUp ?? []).map((r) => String(r.entity_code)));
  wanted = wanted.filter((c) => !recent.has(c));
  if (wanted.length === 0) return [];

  const { data, error } = await db
    .from(TABLE)
    .update({ status: "EXPIRED" })
    .eq("status", "PENDING")
    .in("code", wanted)
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
