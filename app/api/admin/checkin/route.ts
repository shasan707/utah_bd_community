import { jsonError, jsonOk, readJsonBody, requireAdmin } from "@/lib/supabase-server";
import { checkIn, undoCheckIn } from "@/lib/payments/checkin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Door check-in for signed-in admins and volunteers.
 * Body: { code, token?, action?: "undo" }. The token comes from a scanned
 * QR; a manual check-in from the list sends none.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const body = await readJsonBody(req);
    const result =
      body.action === "undo"
        ? await undoCheckIn(body.code, admin.email)
        : await checkIn(body.code, body.token, admin.email);
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
