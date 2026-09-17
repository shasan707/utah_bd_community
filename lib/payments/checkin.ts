import "server-only";
import { ApiError, getServiceClient } from "@/lib/supabase-server";
import { audit } from "./audit";
import { CODE_PATTERN, normalizeCode } from "./codes";
import { formatInEventZone } from "./dates";
import { headcount, money, outstanding } from "./pricing";
import { verifyTicketToken } from "./ticket";
import { parseRegistration, type RegistrationRow } from "./types";

/**
 * The desk. Two separate things are handed over, and each has its own stamp
 * so neither can be given twice:
 *
 *   entry    wristbands, one per person on the row   -> checked_in_at
 *   coupons  the raffle coupons bought on the row     -> coupons_collected_at
 *
 * They are separate because a person can hold either without the other: a
 * coupons-only code admits nobody, and a ticket may carry no coupons. Every
 * stamp and every undo writes an audit row.
 */

const TABLE = "registrations";

export type CheckInOutcome =
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

export type CheckInResult = {
  outcome: CheckInOutcome;
  message: string;
  row: RegistrationRow | null;
};

async function readRow(code: string): Promise<RegistrationRow | null> {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  return data ? parseRegistration(data) : null;
}

function cleanCode(raw: unknown): string | null {
  const code = normalizeCode(String(raw ?? ""));
  return CODE_PATTERN.test(code) ? code : null;
}

/** The row behind a code, or the reason there is nothing to do with it. */
async function paidRow(
  rawCode: unknown
): Promise<{ code: string; row: RegistrationRow } | CheckInResult> {
  const code = cleanCode(rawCode);
  if (!code) {
    return { outcome: "unknown", message: "That is not a ticket code.", row: null };
  }
  const row = await readRow(code);
  if (!row) {
    return { outcome: "unknown", message: `No registration with code ${code}.`, row: null };
  }
  if (row.status !== "PAID") {
    return {
      outcome: "not_paid",
      message: `${row.name} is ${row.status}, not paid. Take payment at the desk first.`,
      row,
    };
  }
  return { code, row };
}

function coupons(n: number): string {
  return `${n} coupon${n === 1 ? "" : "s"}`;
}

/**
 * Entry. Wristbands for everyone on the row.
 *
 * token: the signature from the QR. Empty for a manual check-in by name or
 * typed code, which is allowed because a signed-in admin is doing it.
 *
 * A code with no seats is turned away from entry on purpose. It used to be
 * welcomed like a ticket, which would have let a two dollar coupon purchase
 * walk in. It is sent to the coupon handover instead, with no stamp here.
 */
export async function checkIn(
  rawCode: unknown,
  rawToken: unknown,
  actor: string
): Promise<CheckInResult> {
  const token = String(rawToken ?? "").trim();
  const code0 = cleanCode(rawCode);
  if (code0 && token && !verifyTicketToken(code0, token)) {
    return {
      outcome: "invalid",
      message: `This QR does not match ticket ${code0}. Check the name in the list instead.`,
      row: null,
    };
  }

  const found = await paidRow(rawCode);
  if ("outcome" in found) return found;
  const { code, row } = found;

  if (headcount(row) === 0) {
    if (row.coupons_qty > 0) {
      return {
        outcome: "coupons_only",
        message: `${code} admits nobody: it is ${coupons(row.coupons_qty)} only. Hand over the coupons, no wristband.`,
        row,
      };
    }
    return {
      outcome: "nothing_to_admit",
      message: `${code} is a donation only. Nothing to hand over; just say thank you.`,
      row,
    };
  }

  if (row.checked_in_at) return already(row);

  const now = new Date().toISOString();
  // The null filter makes two volunteers scanning the same ticket harmless:
  // only the first update goes through.
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update({ checked_in_at: now, checked_in_by: actor })
    .eq("code", code)
    .is("checked_in_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) {
    const again = await readRow(code);
    return again ? already(again) : { outcome: "unknown", message: `Code ${code} vanished.`, row: null };
  }

  await audit(actor, "CHECK_IN", code, null, { checked_in_at: now }, token ? "qr" : "manual");
  const fresh = parseRegistration(data);
  const extra =
    fresh.coupons_qty > 0 && !fresh.coupons_collected_at
      ? ` Also hand over ${coupons(fresh.coupons_qty)}.`
      : "";
  return {
    outcome: "checked_in",
    message: `Welcome, ${fresh.name}. ${headcount(fresh)} wristband${headcount(fresh) === 1 ? "" : "s"}.${extra}`,
    row: fresh,
  };
}

function already(row: RegistrationRow): CheckInResult {
  const at = row.checked_in_at ? formatInEventZone(new Date(row.checked_in_at)) : "";
  const by = row.checked_in_by ? ` by ${row.checked_in_by}` : "";
  return {
    outcome: "already",
    message: `${row.name} already checked in at ${at}${by}.`,
    row,
  };
}

/** Reverses a check-in made by mistake. */
export async function undoCheckIn(rawCode: unknown, actor: string): Promise<CheckInResult> {
  const code = cleanCode(rawCode);
  if (!code) {
    return { outcome: "unknown", message: "That is not a ticket code.", row: null };
  }
  const row = await readRow(code);
  if (!row) {
    return { outcome: "unknown", message: `No registration with code ${code}.`, row: null };
  }
  if (!row.checked_in_at) {
    return { outcome: "undone", message: `${row.name} was not checked in.`, row };
  }
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update({ checked_in_at: null, checked_in_by: "" })
    .eq("code", code)
    .select("*")
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  await audit(
    actor,
    "CHECK_IN_UNDO",
    code,
    { checked_in_at: row.checked_in_at, checked_in_by: row.checked_in_by },
    null,
    ""
  );
  return {
    outcome: "undone",
    message: `Check-in for ${row.name} undone.`,
    row: data ? parseRegistration(data) : row,
  };
}

/** Coupons. Hands over every raffle coupon on the row, once. */
export async function collectCoupons(rawCode: unknown, actor: string): Promise<CheckInResult> {
  const found = await paidRow(rawCode);
  if ("outcome" in found) return found;
  const { code, row } = found;

  if (row.coupons_qty === 0) {
    return { outcome: "no_coupons", message: `${code} has no coupons on it.`, row };
  }
  // Coupons added to a code after it was paid are not paid for until the
  // balance is cleared, and goods are not handed over on credit. Entry is a
  // different matter: those seats were settled by the earlier payment, so
  // the door is not affected by this.
  const owed = outstanding(row);
  if (owed > 0) {
    return {
      outcome: "not_paid",
      message: `${row.name} still owes ${money(owed)} on ${code}. Take the payment, then hand over the coupons.`,
      row,
    };
  }
  if (row.coupons_collected_at) {
    const at = formatInEventZone(new Date(row.coupons_collected_at));
    const by = row.coupons_collected_by ? ` by ${row.coupons_collected_by}` : "";
    return {
      outcome: "already_collected",
      message: `${row.name} already collected ${coupons(row.coupons_qty)} at ${at}${by}.`,
      row,
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update({ coupons_collected_at: now, coupons_collected_by: actor })
    .eq("code", code)
    .is("coupons_collected_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) {
    const again = await readRow(code);
    return again
      ? collectCoupons(again.code, actor)
      : { outcome: "unknown", message: `Code ${code} vanished.`, row: null };
  }

  await audit(actor, "COUPONS_COLLECTED", code, null, { coupons_collected_at: now, coupons_qty: row.coupons_qty }, "");
  return {
    outcome: "collected",
    message: `Hand ${row.name} ${coupons(row.coupons_qty)}.`,
    row: parseRegistration(data),
  };
}

/** Reverses a coupon handover recorded by mistake. */
export async function undoCollectCoupons(rawCode: unknown, actor: string): Promise<CheckInResult> {
  const code = cleanCode(rawCode);
  if (!code) {
    return { outcome: "unknown", message: "That is not a ticket code.", row: null };
  }
  const row = await readRow(code);
  if (!row) {
    return { outcome: "unknown", message: `No registration with code ${code}.`, row: null };
  }
  if (!row.coupons_collected_at) {
    return { outcome: "undone", message: `No coupons were handed over on ${code}.`, row };
  }
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update({ coupons_collected_at: null, coupons_collected_by: "" })
    .eq("code", code)
    .select("*")
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  await audit(
    actor,
    "COUPONS_COLLECTED_UNDO",
    code,
    { coupons_collected_at: row.coupons_collected_at, coupons_collected_by: row.coupons_collected_by },
    null,
    ""
  );
  return {
    outcome: "undone",
    message: `Coupon handover for ${row.name} undone.`,
    row: data ? parseRegistration(data) : row,
  };
}
