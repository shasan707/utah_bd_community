import { jsonError, jsonOk, readJsonBody, requireAdmin } from "@/lib/supabase-server";
import {
  checkIn,
  collectCoupons,
  undoCheckIn,
  undoCollectCoupons,
} from "@/lib/payments/checkin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The desk, for signed-in admins and volunteers.
 * Body: { code, token?, action? }
 *   (none)          entry: wristbands for the row; the token comes from a
 *                   scanned QR, a manual check-in from the list sends none
 *   "undo"          reverse an entry
 *   "collect"       hand over the raffle coupons on the row
 *   "undo_collect"  reverse a coupon handover
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const body = await readJsonBody(req);
    let result;
    switch (body.action) {
      case "undo":
        result = await undoCheckIn(body.code, admin.email);
        break;
      case "collect":
        result = await collectCoupons(body.code, admin.email);
        break;
      case "undo_collect":
        result = await undoCollectCoupons(body.code, admin.email);
        break;
      default:
        result = await checkIn(body.code, body.token, admin.email);
    }
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
