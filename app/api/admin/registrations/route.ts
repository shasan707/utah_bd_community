import {
  jsonError,
  jsonOk,
  readJsonBody,
  requireAdmin,
} from "@/lib/supabase-server";
import { createAdminEntry } from "@/lib/payments/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Walk-in or phone registration entered by the treasurer. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const body = await readJsonBody(req);
    const result = await createAdminEntry(
      body,
      { markPaidNow: Boolean(body.mark_paid_now), method: body.method },
      admin.email
    );
    return jsonOk({
      code: result.row.code,
      amount: result.row.amount_due,
      status: result.row.status,
      message: result.message,
      registration: result.row,
    });
  } catch (err) {
    return jsonError(err);
  }
}
