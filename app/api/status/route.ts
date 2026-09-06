import { ApiError, getServiceClient, jsonError, jsonOk } from "@/lib/supabase-server";
import { CODE_PATTERN, normalizeCode } from "@/lib/payments/codes";
import { breakdownLines } from "@/lib/payments/pricing";
import { getSettings } from "@/lib/payments/settings";
import { formatDateOnly } from "@/lib/payments/dates";
import { parseRegistration } from "@/lib/payments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public progress of one registration, for the tracker on the register page
 * and the "track your registration" link in emails. The code alone is not
 * enough: the email used to register must match too, so nobody can read
 * other people's rows by guessing codes.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = normalizeCode(url.searchParams.get("code") || "");
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    if (!CODE_PATTERN.test(code) || !email) {
      throw new ApiError(400, "Enter your code and the email you registered with.");
    }

    const [{ data, error }, settings] = await Promise.all([
      getServiceClient().from("registrations").select("*").eq("code", code).maybeSingle(),
      getSettings(),
    ]);
    if (error) throw new ApiError(500, error.message);
    const row = data ? parseRegistration(data) : null;
    if (!row || row.email !== email) {
      throw new ApiError(
        404,
        "We could not find that registration. Check the code and the email you used."
      );
    }

    return jsonOk({
      code: row.code,
      name: row.name,
      status: row.status,
      created_at: row.created_at,
      amount_due: row.amount_due,
      amount_received: row.amount_received,
      paid_at: row.paid_at,
      payment_method: row.payment_method,
      code_emailed: Boolean(row.pending_email_sent_at),
      receipt_sent: Boolean(row.receipt_sent_at),
      email_queued: row.email_error === "queued",
      adults: row.adults,
      children: row.children,
      coupons_qty: row.coupons_qty,
      breakdown: breakdownLines(row, settings),
      event: {
        name: settings.event_name,
        date: formatDateOnly(settings.event_date),
        time: settings.event_time,
        venue: settings.event_venue,
      },
      zelle: {
        recipient: settings.zelle_recipient,
        recipient_name: settings.zelle_recipient_name,
      },
      contact_email: settings.contact_email,
    });
  } catch (err) {
    return jsonError(err);
  }
}
