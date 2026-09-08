import "server-only";
import { ApiError, getServiceClient } from "@/lib/supabase-server";
import { audit } from "./audit";
import { CODE_PATTERN, normalizeCode } from "./codes";
import { formatInEventZone } from "./dates";
import { verifyTicketToken } from "./ticket";
import { parseRegistration, type RegistrationRow } from "./types";

/**
 * Door check-in. One scan (or one tap on a name) marks a PAID registration
 * as arrived. A second scan is refused with the time of the first, so a
 * ticket cannot be used twice. Every check-in and undo writes an audit row.
 */

const TABLE = "registrations";

export type CheckInOutcome =
  | "checked_in"
  | "already"
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

/**
 * token: the signature from the QR. Empty for a manual check-in by name or
 * typed code, which is allowed because a signed-in admin is doing it.
 */
export async function checkIn(
  rawCode: unknown,
  rawToken: unknown,
  actor: string
): Promise<CheckInResult> {
  const code = cleanCode(rawCode);
  if (!code) {
    return { outcome: "unknown", message: "That is not a ticket code.", row: null };
  }
  const token = String(rawToken ?? "").trim();
  if (token && !verifyTicketToken(code, token)) {
    return {
      outcome: "invalid",
      message: `This QR does not match ticket ${code}. Check the name in the list instead.`,
      row: null,
    };
  }

  const row = await readRow(code);
  if (!row) {
    return { outcome: "unknown", message: `No registration with code ${code}.`, row: null };
  }
  if (row.status !== "PAID") {
    return {
      outcome: "not_paid",
      message: `${row.name} is ${row.status}, not paid. Take payment at the desk, then check in.`,
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
  return {
    outcome: "checked_in",
    message: `Welcome, ${data.name}.`,
    row: parseRegistration(data),
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
